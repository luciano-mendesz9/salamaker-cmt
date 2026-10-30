import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { apiError, requireTeacher } from "@/lib/authorization";
import { applyActivityAward } from "@/lib/activity-awards";
import { validateWrittenGrade } from "@/lib/activities";
import { prisma } from "@/lib/db";

const input = z.object({ grades: z.array(z.object({ answerId: z.string().uuid(), grade: z.enum(["CORRECT", "INCORRECT", "PARTIAL"]), awardedXp: z.number().int().min(0), comment: z.string().trim().max(1000).optional() })) });
async function gradeTransaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try { return await prisma.$transaction(operation, { isolationLevel: "Serializable", maxWait: 10_000, timeout: 20_000 }); }
    catch (error) { if ((error as { code?: string }).code === "P2034" && attempt < 2) continue; throw error; }
  }
  throw new Error("TRANSACTION_RETRY_EXHAUSTED");
}
export async function POST(request: Request, { params }: { params: Promise<{ id: string; submissionId: string }> }) {
  try {
    const teacher = await requireTeacher(); const { id, submissionId } = await params; const body = input.parse(await request.json());
    const submission = await prisma.activitySubmission.findFirst({ where: { id: submissionId, activityId: id }, include: { activity: true, recipient: true, answers: { include: { question: true } } } });
    if (!submission || !["FORM", "CPP_CODE"].includes(submission.activity.type)) return NextResponse.json({ message: "Envio não encontrado." }, { status: 404 });
    const written = submission.answers.filter((answer) => answer.question.type === "WRITTEN");
    const gradeByAnswer = new Map(body.grades.map((grade) => [grade.answerId, grade]));
    if (written.length !== gradeByAnswer.size || written.some((answer) => !gradeByAnswer.has(answer.id))) return NextResponse.json({ message: "Avalie todas as respostas escritas." }, { status: 400 });
    for (const answer of written) { const grade = gradeByAnswer.get(answer.id)!; validateWrittenGrade(grade.grade, grade.awardedXp, answer.question.maxXp); }
    const total = submission.answers.reduce((sum, answer) => sum + (answer.question.type === "WRITTEN" ? gradeByAnswer.get(answer.id)!.awardedXp : answer.awardedXp ?? 0), 0);
    const result = await gradeTransaction(async (tx) => {
      for (const answer of written) { const grade = gradeByAnswer.get(answer.id)!; await tx.activityAnswer.update({ where: { id: answer.id }, data: { writtenGrade: grade.grade, awardedXp: grade.awardedXp, comment: grade.comment || null } }); }
      await tx.activitySubmission.update({ where: { id: submission.id }, data: { status: "GRADED", gradedAt: new Date() } });
      const award = await applyActivityAward(tx, { activityId: id, recipientId: submission.recipientId, studentId: submission.studentId, teacherId: teacher.id, awardedXp: total, maxXp: submission.activity.maxXp, reason: `${submission.activity.type === "CPP_CODE" ? "Código C++" : "Formulário"} “${submission.activity.title}” corrigido: ${total} XP.` });
      await tx.auditLog.create({ data: { actorId: teacher.id, targetId: submission.studentId, event: "ACTIVITY_GRADED", details: { activityId: id, submissionId, awardedXp: total, delta: award.delta } } });
      return award;
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError || (error instanceof Error && error.message === "INVALID_GRADE")) return NextResponse.json({ message: "A correção informada é inválida." }, { status: 400 });
    const [message, status] = apiError(error); return NextResponse.json({ message }, { status });
  }
}
