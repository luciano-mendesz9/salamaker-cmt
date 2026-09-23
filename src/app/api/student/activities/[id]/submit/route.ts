import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireStudent } from "@/lib/authorization";
import { applyActivityAward } from "@/lib/activity-awards";
import { assertOpenForSubmission, gradeObjectiveAnswer } from "@/lib/activities";
import { prisma } from "@/lib/db";

const input = z.object({ answers: z.array(z.object({ questionId: z.string().uuid(), selectedOptionIds: z.array(z.string().uuid()).default([]), writtenText: z.string().trim().max(10000).optional() })).max(100) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { student } = await requireStudent(); const { id } = await params; const body = input.parse(await request.json());
    const recipient = await prisma.activityRecipient.findUnique({
      where: { activityId_studentId: { activityId: id, studentId: student.id } },
      include: { activity: { include: { questions: { include: { options: true }, orderBy: { position: "asc" } } } }, submission: { select: { id: true } } },
    });
    if (!recipient || recipient.activity.type !== "FORM") return NextResponse.json({ message: "Atividade não encontrada." }, { status: 404 });
    assertOpenForSubmission(recipient.activity);
    if (recipient.submission) return NextResponse.json({ message: "Este formulário já foi enviado." }, { status: 409 });
    const answerByQuestion = new Map(body.answers.map((answer) => [answer.questionId, answer]));
    if (answerByQuestion.size !== recipient.activity.questions.length) return NextResponse.json({ message: "Responda todas as questões antes de enviar." }, { status: 400 });
    const prepared = recipient.activity.questions.map((question) => {
      const answer = answerByQuestion.get(question.id); if (!answer) throw new Error("INVALID_ANSWERS");
      if (question.type === "WRITTEN") {
        if (!answer.writtenText) throw new Error("INVALID_ANSWERS");
        return { question, writtenText: answer.writtenText, selected: [] as string[], autoCorrect: null, awardedXp: null };
      }
      if (question.type === "SINGLE_CHOICE" && answer.selectedOptionIds.length !== 1) throw new Error("INVALID_ANSWERS");
      if (question.type === "MULTIPLE_CHOICE" && answer.selectedOptionIds.length < 1) throw new Error("INVALID_ANSWERS");
      const result = gradeObjectiveAnswer(answer.selectedOptionIds, question.options, question.maxXp);
      return { question, writtenText: null, selected: answer.selectedOptionIds, autoCorrect: result.correct, awardedXp: result.awardedXp };
    });
    const hasWritten = prepared.some((answer) => answer.question.type === "WRITTEN");
    const result = await prisma.$transaction(async (tx) => {
      const submission = await tx.activitySubmission.create({ data: { activityId: id, recipientId: recipient.id, studentId: student.id, status: hasWritten ? "AWAITING_REVIEW" : "GRADED", gradedAt: hasWritten ? null : new Date() } });
      for (const answer of prepared) await tx.activityAnswer.create({ data: {
        submissionId: submission.id, questionId: answer.question.id, studentId: student.id, writtenText: answer.writtenText, autoCorrect: answer.autoCorrect, awardedXp: answer.awardedXp,
        selections: { create: answer.selected.map((optionId) => ({ optionId })) },
      } });
      await tx.activityRecipient.update({ where: { id: recipient.id }, data: { completedAt: new Date() } });
      if (!hasWritten) {
        const total = prepared.reduce((sum, answer) => sum + (answer.awardedXp ?? 0), 0);
        await applyActivityAward(tx, { activityId: id, recipientId: recipient.id, studentId: student.id, teacherId: recipient.activity.authorId, awardedXp: total, maxXp: recipient.activity.maxXp, reason: `Formulário “${recipient.activity.title}” corrigido automaticamente: ${total} XP.` });
      }
      return submission;
    });
    return NextResponse.json({ id: result.id, status: result.status }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError || (error instanceof Error && ["INVALID_ANSWERS", "INVALID_OPTIONS"].includes(error.message))) return NextResponse.json({ message: "Revise as respostas do formulário." }, { status: 400 });
    if (error instanceof Error && error.message === "ACTIVITY_NOT_OPEN") return NextResponse.json({ message: "O prazo desta atividade não está aberto." }, { status: 409 });
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") return NextResponse.json({ message: "Este formulário já foi enviado." }, { status: 409 });
    const [message, status] = apiError(error); return NextResponse.json({ message }, { status });
  }
}
