import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireTeacher } from "@/lib/authorization";
import { applyActivityAward } from "@/lib/activity-awards";
import { prisma } from "@/lib/db";

const input = z.object({ awardedXp: z.number().int().min(0), observation: z.string().trim().max(1000).optional() });
export async function POST(request: Request, { params }: { params: Promise<{ id: string; teamId: string }> }) {
  try {
    const teacher = await requireTeacher(); const { id, teamId } = await params; const body = input.parse(await request.json());
    const team = await prisma.activityTeam.findFirst({ where: { id: teamId, activityId: id }, include: { activity: true, members: true } });
    if (!team || team.activity.type !== "GROUP") return NextResponse.json({ message: "Equipe não encontrada." }, { status: 404 });
    if (new Date() < team.activity.opensAt) return NextResponse.json({ message: "A atividade ainda não abriu." }, { status: 409 });
    if (body.awardedXp > team.activity.maxXp) return NextResponse.json({ message: "A pontuação supera o máximo da atividade." }, { status: 400 });
    const result = await prisma.$transaction(async (tx) => {
      const deltas = [];
      for (const member of team.members) deltas.push(await applyActivityAward(tx, { activityId: id, recipientId: member.recipientId, studentId: member.studentId, teacherId: teacher.id, awardedXp: body.awardedXp, maxXp: team.activity.maxXp, observation: body.observation, reason: `Atividade em grupo “${team.activity.title}” corrigida: ${body.awardedXp} XP.` }));
      await tx.activityTeam.update({ where: { id: team.id }, data: { completedAt: new Date() } });
      await tx.auditLog.create({ data: { actorId: teacher.id, event: "ACTIVITY_GRADED", details: { activityId: id, teamId, awardedXp: body.awardedXp, memberCount: team.members.length, deltas: deltas.map((item) => item.delta) } } });
      return deltas;
    });
    return NextResponse.json({ students: result.length });
  } catch (error) {
    if (error instanceof z.ZodError || (error instanceof Error && error.message === "INVALID_ACTIVITY_XP")) return NextResponse.json({ message: "A pontuação informada é inválida." }, { status: 400 });
    const [message, status] = apiError(error); return NextResponse.json({ message }, { status });
  }
}
