import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, requireTeacher } from "@/lib/authorization";
import { balancedTeams, effectiveActivityState } from "@/lib/activities";

const option = z.object({ text: z.string().trim().min(1).max(300), isCorrect: z.boolean() });
const question = z.object({
  prompt: z.string().trim().min(1).max(2000),
  type: z.enum(["SINGLE_CHOICE", "MULTIPLE_CHOICE", "WRITTEN"]),
  maxXp: z.number().int().min(0).max(10000),
  options: z.array(option).max(20).default([]),
});
const input = z.object({
  title: z.string().trim().min(3).max(150),
  description: z.string().trim().max(5000).optional(),
  type: z.enum(["EXTERNAL_LINK", "FORM", "GROUP"]),
  opensAt: z.coerce.date(),
  closesAt: z.coerce.date(),
  maxXp: z.number().int().min(0).max(100000).optional(),
  externalUrl: z.string().url().optional(),
  questions: z.array(question).max(100).default([]),
  divisionMode: z.enum(["RANDOM", "MANUAL"]).optional(),
  teamCount: z.number().int().min(1).max(100).optional(),
  teams: z.array(z.object({ name: z.string().trim().min(1).max(80), studentIds: z.array(z.string().uuid()) })).max(100).default([]),
});

function validateActivity(body: z.infer<typeof input>, eligibleIds: string[]) {
  if (body.closesAt <= body.opensAt) throw new Error("INVALID_DATES");
  if (body.type === "EXTERNAL_LINK") {
    if (!body.externalUrl || new URL(body.externalUrl).protocol !== "https:") throw new Error("INVALID_URL");
    if (body.maxXp === undefined) throw new Error("INVALID_MAX_XP");
  }
  if (body.type === "FORM") {
    if (!body.questions.length) throw new Error("INVALID_QUESTIONS");
    for (const item of body.questions) {
      if (item.type === "WRITTEN" && item.options.length) throw new Error("INVALID_QUESTIONS");
      if (item.type !== "WRITTEN") {
        if (item.options.length < 2) throw new Error("INVALID_QUESTIONS");
        const correct = item.options.filter((choice) => choice.isCorrect).length;
        if ((item.type === "SINGLE_CHOICE" && correct !== 1) || (item.type === "MULTIPLE_CHOICE" && correct < 1)) throw new Error("INVALID_QUESTIONS");
      }
    }
  }
  if (body.type === "GROUP") {
    if (body.maxXp === undefined || !body.divisionMode || !body.teamCount || body.teamCount > eligibleIds.length) throw new Error("INVALID_TEAMS");
    if (body.divisionMode === "MANUAL" || body.teams.length) {
      if (body.teams.length !== body.teamCount || body.teams.some((team) => !team.studentIds.length)) throw new Error("INVALID_TEAMS");
      const assigned = body.teams.flatMap((team) => team.studentIds);
      if (assigned.length !== new Set(assigned).size || assigned.length !== eligibleIds.length || assigned.some((id) => !eligibleIds.includes(id))) throw new Error("INVALID_TEAMS");
    }
  }
}

export async function GET() {
  try {
    await requireTeacher();
    const activities = await prisma.activity.findMany({
      include: { recipients: { select: { completedAt: true, studentSignaledAt: true } }, submissions: { select: { status: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(activities.map((activity) => ({ ...activity, state: effectiveActivityState(activity) })));
  } catch (error) {
    const [message, status] = apiError(error); return NextResponse.json({ message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const teacher = await requireTeacher();
    const body = input.parse(await request.json());
    const students = await prisma.user.findMany({ where: { role: "STUDENT", status: "ACTIVE" }, select: { id: true } });
    if (!students.length) return NextResponse.json({ message: "A turma de Robótica não possui alunos ativos." }, { status: 400 });
    validateActivity(body, students.map((student) => student.id));
    const maxXp = body.type === "FORM" ? body.questions.reduce((sum, item) => sum + item.maxXp, 0) : body.maxXp!;
    const created = await prisma.$transaction(async (tx) => {
      const activity = await tx.activity.create({
        data: {
          title: body.title,
          description: body.description || null,
          type: body.type,
          opensAt: body.opensAt,
          closesAt: body.closesAt,
          maxXp,
          externalUrl: body.type === "EXTERNAL_LINK" ? body.externalUrl : null,
          divisionMode: body.type === "GROUP" ? body.divisionMode : null,
          authorId: teacher.id,
          recipients: { create: students.map((student) => ({ studentId: student.id })) },
          questions: body.type === "FORM" ? { create: body.questions.map((item, position) => ({
            prompt: item.prompt,
            type: item.type,
            maxXp: item.maxXp,
            position,
            options: { create: item.options.map((choice, optionPosition) => ({ ...choice, position: optionPosition })) },
          })) } : undefined,
        },
      });
      if (body.type === "GROUP") {
        const recipients = await tx.activityRecipient.findMany({ where: { activityId: activity.id }, select: { id: true, studentId: true } });
        const groups = body.teams.length ? body.teams : balancedTeams(recipients, body.teamCount!).map((members, index) => ({ name: `Equipe ${index + 1}`, studentIds: members.map((member) => member.studentId) }));
        const recipientByStudent = new Map(recipients.map((recipient) => [recipient.studentId, recipient.id]));
        for (const [position, group] of groups.entries()) {
          await tx.activityTeam.create({ data: { activityId: activity.id, name: group.name, position, members: { create: group.studentIds.map((studentId) => ({ studentId, recipientId: recipientByStudent.get(studentId)! })) } } });
        }
      }
      await tx.auditLog.create({ data: { actorId: teacher.id, event: "ACTIVITY_CREATED", details: { activityId: activity.id, type: activity.type, audience: "ROBOTICS_COHORT", recipientCount: students.length } } });
      return activity;
    });
    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "Revise os dados da atividade." }, { status: 400 });
    const known: Record<string, string> = { INVALID_DATES: "O fechamento deve ocorrer depois da abertura.", INVALID_URL: "Informe uma URL HTTPS válida.", INVALID_MAX_XP: "Informe o XP máximo.", INVALID_QUESTIONS: "Revise as questões, alternativas e gabaritos.", INVALID_TEAMS: "A divisão das equipes é inválida." };
    if (error instanceof Error && known[error.message]) return NextResponse.json({ message: known[error.message] }, { status: 400 });
    const [message, status] = apiError(error); return NextResponse.json({ message }, { status });
  }
}
