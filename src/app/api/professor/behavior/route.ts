import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, requireTeacher } from "@/lib/authorization";

const input = z.object({ lessonId: z.string().uuid(), studentId: z.string().uuid(), score: z.number().int().min(1).max(5), reason: z.string().trim().max(300).optional() });
const deltaByScore: Record<number, number> = { 1: -30, 2: -25, 3: -5, 4: 20, 5: 30 };
const reasonFor = (delta:number,reason?:string) => `${delta < 0 ? `O professor avaliou seu comportamento nesta aula e você perdeu ${Math.abs(delta)} XP.` : `O professor avaliou seu comportamento nesta aula e você ganhou ${delta} XP.`}${reason ? ` Motivo: ${reason}` : ""}`;

export async function POST(request: Request) {
  try {
    const teacher = await requireTeacher();
    const body = input.parse(await request.json());
    const lesson = await prisma.lesson.findFirst({ where: { id: body.lessonId, status: "CLOSED", attendances: { some: { studentId: body.studentId } } }, select: { id: true } });
    if (!lesson) return NextResponse.json({ message: "Selecione um aluno participante de uma aula fechada." }, { status: 400 });
    const delta = deltaByScore[body.score];
    const message = reasonFor(delta, body.reason);
    const result = await prisma.$transaction(async tx => {
      const current = await tx.behaviorRating.findUnique({ where: { lessonId_studentId: { lessonId: body.lessonId, studentId: body.studentId } }, include: { xpEntry: true } });
      if (!current) {
        const xpEntry = await tx.xpEntry.create({ data: { studentId: body.studentId, lessonId: body.lessonId, authorId: teacher.id, delta, reason: message, source: "BEHAVIOR", idempotencyKey: `behavior:${body.lessonId}:${body.studentId}` } });
        await tx.user.update({ where: { id: body.studentId }, data: { xp: { increment: delta } } });
        const rating = await tx.behaviorRating.create({ data: { lessonId: body.lessonId, studentId: body.studentId, teacherId: teacher.id, score: body.score, reason: body.reason || null, xpEntryId: xpEntry.id } });
        return { rating, corrected: false, effectiveDelta: delta };
      }
      const difference = delta - current.xpEntry.delta;
      await tx.xpEntry.create({ data: { studentId: body.studentId, lessonId: body.lessonId, authorId: teacher.id, delta: -current.xpEntry.delta, reason: "Correção de comportamento: reversão da avaliação anterior.", source: "BEHAVIOR", idempotencyKey: `behavior-reversal:${body.lessonId}:${body.studentId}:${randomUUID()}` } });
      const replacement = await tx.xpEntry.create({ data: { studentId: body.studentId, lessonId: body.lessonId, authorId: teacher.id, delta, reason: message, source: "BEHAVIOR", idempotencyKey: `behavior-correction:${body.lessonId}:${body.studentId}:${randomUUID()}` } });
      await tx.user.update({ where: { id: body.studentId }, data: { xp: { increment: difference } } });
      const rating = await tx.behaviorRating.update({ where: { id: current.id }, data: { score: body.score, reason: body.reason || null, teacherId: teacher.id, xpEntryId: replacement.id } });
      return { rating, corrected: true, effectiveDelta: difference };
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "Avaliação inválida." }, { status: 400 });
    const [message, status] = apiError(error); return NextResponse.json({ message }, { status });
  }
}
