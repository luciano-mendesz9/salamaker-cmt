import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireTeacher } from "@/lib/authorization";
import { applyActivityAward } from "@/lib/activity-awards";
import { prisma } from "@/lib/db";

const input = z.object({ studentId: z.string().uuid(), awardedXp: z.number().int().min(0), observation: z.string().trim().max(1000).optional() });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const teacher = await requireTeacher(); const { id } = await params; const body = input.parse(await request.json());
    const activity = await prisma.activity.findFirst({ where: { id, type: "EXTERNAL_LINK" }, include: { recipients: { where: { studentId: body.studentId }, take: 1 } } });
    const recipient = activity?.recipients[0]; if (!activity || !recipient) return NextResponse.json({ message: "Aluno não pertence a esta atividade." }, { status: 404 });
    if (new Date() < activity.opensAt) return NextResponse.json({ message: "A atividade ainda não abriu." }, { status: 409 });
    const result = await prisma.$transaction(async (tx) => {
      const award = await applyActivityAward(tx, { activityId: id, recipientId: recipient.id, studentId: body.studentId, teacherId: teacher.id, awardedXp: body.awardedXp, maxXp: activity.maxXp, observation: body.observation, reason: `Atividade “${activity.title}” corrigida: ${body.awardedXp} XP.` });
      await tx.auditLog.create({ data: { actorId: teacher.id, targetId: body.studentId, event: "ACTIVITY_GRADED", details: { activityId: id, awardedXp: body.awardedXp, delta: award.delta } } });
      return award;
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError || (error instanceof Error && error.message === "INVALID_ACTIVITY_XP")) return NextResponse.json({ message: "A pontuação deve ser inteira e ficar dentro do limite." }, { status: 400 });
    const [message, status] = apiError(error); return NextResponse.json({ message }, { status });
  }
}
