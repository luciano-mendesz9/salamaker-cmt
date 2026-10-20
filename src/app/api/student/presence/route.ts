import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireStudent } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { verifyLessonCode } from "@/lib/lesson-code";
import { presenceParticipantDecision } from "@/lib/presence-rules";
import { assertSameOrigin, consumeRateLimit } from "@/lib/request-security";

const schema = z.object({ lessonCode: z.string().regex(/^\d{6}$/) });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { student } = await requireStudent();
    await consumeRateLimit(`student-presence:${student.id}`, 10, 10 * 60_000);
    const { lessonCode } = schema.parse(await request.json());
    const lesson = await prisma.lesson.findFirst({ where: { status: "OPEN" }, select: { id: true, openedAt: true, presenceCodeHash: true } });
    if (!lesson || !(await verifyLessonCode(lessonCode, lesson.presenceCodeHash))) {
      return NextResponse.json({ message: "Código da aula inválido ou aula já encerrada." }, { status: 400 });
    }

    let created: boolean | undefined;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        created = await prisma.$transaction(async (tx) => {
          const openLesson = await tx.lesson.findFirst({ where: { id: lesson.id, status: "OPEN" }, select: { id: true, openedAt: true } });
          if (!openLesson) throw new Error("LESSON_ALREADY_CLOSED");
          const participant = await tx.lessonParticipant.findUnique({ where: { lessonId_studentId: { lessonId: lesson.id, studentId: student.id } }, select: { id: true } });
          const decision = presenceParticipantDecision({ isParticipant: Boolean(participant), studentCreatedAt: student.createdAt, lessonOpenedAt: openLesson.openedAt });
          if (decision === "REJECT") throw new Error("NOT_A_LESSON_PARTICIPANT");
          if (decision === "ATTACH_LATE") await tx.lessonParticipant.createMany({ data: [{ lessonId: lesson.id, studentId: student.id }], skipDuplicates: true });
          const attendance = await tx.attendance.createMany({ data: [{ lessonId: lesson.id, studentId: student.id, status: "PRESENT" }], skipDuplicates: true });
          return attendance.count === 1;
        }, { isolationLevel: "Serializable", maxWait: 10_000, timeout: 20_000 });
        break;
      } catch (error) {
        if ((error as { code?: string }).code === "P2034" && attempt < 2) continue;
        throw error;
      }
    }
    if (created === undefined) throw new Error("TRANSACTION_RETRY_EXHAUSTED");
    return NextResponse.json({ message: created ? "Presença confirmada! O XP será aplicado no fechamento da aula." : "Sua presença já estava registrada.", created });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "Digite os seis números do código da aula." }, { status: 400 });
    if (error instanceof Error && error.message === "NOT_A_LESSON_PARTICIPANT") return NextResponse.json({ message: "Você não está entre os participantes desta aula." }, { status: 403 });
    if (error instanceof Error && error.message === "LESSON_ALREADY_CLOSED") return NextResponse.json({ message: "Esta aula já foi encerrada." }, { status: 409 });
    if ((error as { code?: string }).code === "P2028") return NextResponse.json({ message: "O banco demorou para registrar a presença. Tente novamente." }, { status: 503 });
    const [message, status] = apiError(error);
    return NextResponse.json({ message }, { status });
  }
}
