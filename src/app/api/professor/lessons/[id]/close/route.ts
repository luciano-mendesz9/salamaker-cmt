import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, requireTeacher } from "@/lib/authorization";
import { buildLessonSettlements } from "@/lib/lesson-close";

const schema = z.object({
  excusedIds: z.array(z.string().uuid()).max(200),
  presentIds: z.array(z.string().uuid()).max(200).default([]),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const teacher = await requireTeacher();
    const { id } = await params;
    const { excusedIds, presentIds } = schema.parse(await request.json());
    let result: { students: number } | undefined;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        result = await prisma.$transaction(async (tx) => {
          const lesson = await tx.lesson.findUnique({ where: { id }, include: { attendances: true, participants: { select: { studentId: true } } } });
          if (!lesson || lesson.status !== "OPEN") throw new Error("LESSON_ALREADY_CLOSED");
          const settlements = buildLessonSettlements({
            participantIds: lesson.participants.map((participant) => participant.studentId),
            recordedPresentIds: lesson.attendances.filter((attendance) => attendance.status === "PRESENT").map((attendance) => attendance.studentId),
            manualPresentIds: presentIds,
            excusedIds,
          });

          const closed = await tx.lesson.updateMany({ where: { id, status: "OPEN" }, data: { status: "CLOSED", openSlot: null, closedAt: new Date() } });
          if (closed.count !== 1) throw new Error("LESSON_ALREADY_CLOSED");

          await tx.attendance.createMany({
            data: settlements.map(({ studentId, status, manuallyMarkedPresent }) => ({
              lessonId: id,
              studentId,
              status,
              note: manuallyMarkedPresent ? "Presença marcada manualmente pelo professor no fechamento" : undefined,
            })),
            skipDuplicates: true,
          });
          for (const status of ["PRESENT", "EXCUSED", "ABSENT"] as const) {
            const group = settlements.filter((settlement) => settlement.status === status);
            if (!group.length) continue;
            const ids = group.map((settlement) => settlement.studentId);
            await tx.attendance.updateMany({ where: { lessonId: id, studentId: { in: ids } }, data: { status } });
            await tx.user.updateMany({ where: { id: { in: ids } }, data: { xp: { increment: group[0].delta } } });
          }
          await tx.xpEntry.createMany({
            data: settlements.map(({ studentId, delta, reason }) => ({
              studentId,
              lessonId: id,
              authorId: teacher.id,
              delta,
              reason,
              source: "ATTENDANCE",
              idempotencyKey: `lesson-close:${id}:${studentId}`,
            })),
          });
          return { students: lesson.participants.length };
        }, { isolationLevel: "Serializable", maxWait: 10_000, timeout: 20_000 });
        break;
      } catch (error) {
        if ((error as { code?: string }).code === "P2034" && attempt < 2) continue;
        throw error;
      }
    }
    if (!result) throw new Error("TRANSACTION_RETRY_EXHAUSTED");
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError || (error instanceof Error && ["INVALID_PARTICIPANT", "CONFLICTING_ATTENDANCE_REVIEW"].includes(error.message))) return NextResponse.json({ message: "Revisão de presenças e ausências inválida." }, { status: 400 });
    if (error instanceof Error && error.message === "LESSON_ALREADY_CLOSED") return NextResponse.json({ message: "Esta aula já foi fechada." }, { status: 409 });
    if ((error as { code?: string }).code === "P2028") return NextResponse.json({ message: "O banco demorou para fechar a aula. Nenhuma presença ou pontuação foi alterada; tente novamente." }, { status: 503 });
    const [message, status] = apiError(error); return NextResponse.json({ message }, { status });
  }
}
