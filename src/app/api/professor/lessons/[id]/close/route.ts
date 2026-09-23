import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, requireTeacher } from "@/lib/authorization";

const schema = z.object({ excusedIds: z.array(z.string().uuid()).max(200) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const teacher = await requireTeacher();
    const { id } = await params;
    const { excusedIds } = schema.parse(await request.json());
    const result = await prisma.$transaction(async (tx) => {
      const lesson = await tx.lesson.findUnique({ where: { id }, include: { attendances: true, participants: { select: { studentId: true } } } });
      if (!lesson || lesson.status !== "OPEN") throw new Error("LESSON_ALREADY_CLOSED");
      const participantIds = new Set(lesson.participants.map((participant) => participant.studentId));
      if (excusedIds.some((studentId) => !participantIds.has(studentId))) throw new Error("INVALID_PARTICIPANT");
      const present = new Set(lesson.attendances.filter((attendance) => attendance.status === "PRESENT").map((attendance) => attendance.studentId));
      const excused = new Set(excusedIds);
      const closed = await tx.lesson.updateMany({ where: { id, status: "OPEN" }, data: { status: "CLOSED", openSlot: null, closedAt: new Date() } });
      if (closed.count !== 1) throw new Error("LESSON_ALREADY_CLOSED");
      for (const { studentId } of lesson.participants) {
        const status = present.has(studentId) ? "PRESENT" : excused.has(studentId) ? "EXCUSED" : "ABSENT";
        const delta = status === "PRESENT" ? 30 : status === "EXCUSED" ? 10 : -50;
        await tx.attendance.upsert({ where: { lessonId_studentId: { lessonId: id, studentId } }, create: { lessonId: id, studentId, status }, update: { status } });
        await tx.user.update({ where: { id: studentId }, data: { xp: { increment: delta } } });
        await tx.xpEntry.create({ data: { studentId, lessonId: id, authorId: teacher.id, delta, reason: status === "PRESENT" ? "Presença confirmada" : status === "EXCUSED" ? "Ausência justificada" : "Ausência sem justificativa", source: "ATTENDANCE", idempotencyKey: `lesson-close:${id}:${studentId}` } });
      }
      return { students: lesson.participants.length };
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError || (error instanceof Error && error.message === "INVALID_PARTICIPANT")) return NextResponse.json({ message: "Revisão de ausências inválida." }, { status: 400 });
    if (error instanceof Error && error.message === "LESSON_ALREADY_CLOSED") return NextResponse.json({ message: "Esta aula já foi fechada." }, { status: 409 });
    const [message, status] = apiError(error); return NextResponse.json({ message }, { status });
  }
}
