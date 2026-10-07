import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyLessonCode } from "@/lib/lesson-code";
import { presenceParticipantDecision } from "@/lib/presence-rules";
import { assertSameOrigin } from "@/lib/request-security";

const schema = z.object({ accessCode: z.string().trim().toUpperCase(), lessonCode: z.string().regex(/^\d{6}$/) });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = schema.parse(await request.json());
    const settings = await prisma.appSetting.findUnique({ where: { id: 1 } });
    if (settings && !settings.studentAreaEnabled) return NextResponse.json({ message: "O site foi desativado temporariamente pelo professor." }, { status: 403 });
    const student = await prisma.user.findFirst({ where: { accessCode: body.accessCode, role: "STUDENT", status: "ACTIVE" }, select: { id: true, createdAt: true } });
    const lessons = await prisma.lesson.findMany({ where: { status: "OPEN" } });
    let lesson = null;
    for (const candidate of lessons) if (await verifyLessonCode(body.lessonCode, candidate.presenceCodeHash)) { lesson = candidate; break; }
    if (!student || !lesson) return NextResponse.json({ message: "Não foi possível confirmar a presença com esses dados." }, { status: 400 });
    let created: boolean | undefined;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        created = await prisma.$transaction(async (tx) => {
          const openLesson = await tx.lesson.findFirst({ where: { id: lesson.id, status: "OPEN" }, select: { id: true, openedAt: true } });
          if (!openLesson) throw new Error("LESSON_ALREADY_CLOSED");
          const participant = await tx.lessonParticipant.findUnique({ where: { lessonId_studentId: { lessonId: lesson.id, studentId: student.id } }, select: { id: true } });
          const decision = presenceParticipantDecision({ isParticipant: Boolean(participant), studentCreatedAt: student.createdAt, lessonOpenedAt: openLesson.openedAt });
          if (decision === "REJECT") throw new Error("NOT_A_LESSON_PARTICIPANT");
          if (decision === "ATTACH_LATE") {
            await tx.lessonParticipant.createMany({ data: [{ lessonId: lesson.id, studentId: student.id }], skipDuplicates: true });
          }
          const attendance = await tx.attendance.createMany({
            data: [{ lessonId: lesson.id, studentId: student.id, status: "PRESENT" }],
            skipDuplicates: true,
          });
          return attendance.count === 1;
        }, { isolationLevel: "Serializable", maxWait: 10_000, timeout: 20_000 });
        break;
      } catch (error) {
        if ((error as { code?: string }).code === "P2034" && attempt < 2) continue;
        throw error;
      }
    }
    if (created === undefined) throw new Error("TRANSACTION_RETRY_EXHAUSTED");
    return NextResponse.json({ message: created ? "Presença confirmada! O XP será aplicado no fechamento da aula." : "Sua presença já estava registrada." });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "Informe o código do aluno e os seis dígitos da aula." }, { status: 400 });
    if (error instanceof Error && error.message === "NOT_A_LESSON_PARTICIPANT") return NextResponse.json({ message: "Você não estava entre os participantes desta aula quando ela foi aberta." }, { status: 403 });
    if (error instanceof Error && error.message === "LESSON_ALREADY_CLOSED") return NextResponse.json({ message: "Esta aula já foi fechada." }, { status: 409 });
    if ((error as { code?: string }).code === "P2028") return NextResponse.json({ message: "O banco demorou para registrar a presença. Tente novamente." }, { status: 503 });
    if (error instanceof Error && error.message === "INVALID_ORIGIN") return NextResponse.json({ message: "Origem da solicitação inválida." }, { status: 403 });
    return NextResponse.json({ message: "Não foi possível registrar a presença." }, { status: 500 });
  }
}
