import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, requireTeacher } from "@/lib/authorization";
import { protectLessonCode, revealLessonCode } from "@/lib/lesson-code";

const schema = z.object({ title: z.string().trim().min(3).max(100) });

export async function GET() {
  try {
    await requireTeacher();
    let lesson = await prisma.lesson.findFirst({
      where: { status: "OPEN" },
      orderBy: { openedAt: "desc" },
      include: {
        attendances: { select: { studentId: true, status: true } },
        cleanups: { select: { id: true, confirmedAt: true, student: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { confirmedAt: "asc" } },
        teacher: { select: { firstName: true, lastName: true } },
        participants: { include: { student: { select: { id: true, firstName: true, lastName: true, originSchoolClass: true } } }, orderBy: { student: { firstName: "asc" } } },
      },
    });
    if (!lesson) return NextResponse.json({ lesson: null, students: [] });
    let code = revealLessonCode(lesson.presenceCodeHash);
    if (!code) {
      code = String(randomInt(100000, 1000000));
      const presenceCodeHash = protectLessonCode(code);
      const rotated = await prisma.lesson.updateMany({
        where: { id: lesson.id, status: "OPEN", presenceCodeHash: lesson.presenceCodeHash },
        data: { presenceCodeHash },
      });
      if (!rotated.count) {
        lesson = await prisma.lesson.findUniqueOrThrow({
          where: { id: lesson.id },
          include: {
            attendances: { select: { studentId: true, status: true } },
            cleanups: { select: { id: true, confirmedAt: true, student: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { confirmedAt: "asc" } },
            teacher: { select: { firstName: true, lastName: true } },
            participants: { include: { student: { select: { id: true, firstName: true, lastName: true, originSchoolClass: true } } }, orderBy: { student: { firstName: "asc" } } },
          },
        });
        code = revealLessonCode(lesson.presenceCodeHash);
      }
    }
    if (!code) throw new Error("LESSON_CODE_UNAVAILABLE");
    const students = lesson.participants.map((participant) => participant.student);
    return NextResponse.json({
      lesson: { id: lesson.id, title: lesson.title, openedAt: lesson.openedAt, attendances: lesson.attendances, cleanups: lesson.cleanups, code },
      students,
    });
  } catch (error) {
    const [message, status] = apiError(error); return NextResponse.json({ message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const teacher = await requireTeacher();
    const body = schema.parse(await request.json());
    const existing = await prisma.lesson.findFirst({ where: { status: "OPEN" }, select: { id: true } });
    if (existing) return NextResponse.json({ message: "Já existe uma aula aberta. Feche-a antes de iniciar outra." }, { status: 409 });
    const students = await prisma.user.findMany({ where: { role: "STUDENT", status: "ACTIVE" }, select: { id: true } });
    if (!students.length) return NextResponse.json({ message: "Cadastre ao menos um aluno ativo na turma de Robótica." }, { status: 400 });
    const code = String(randomInt(100000, 1000000));
    const presenceCodeHash = protectLessonCode(code);
    const lesson = await prisma.lesson.create({
      data: {
        title: body.title,
        teacherId: teacher.id,
        openSlot: "ROBOTICS",
        presenceCodeHash,
        participants: { create: students.map((student) => ({ studentId: student.id })) },
      },
      select: { id: true, title: true, openedAt: true },
    });
    return NextResponse.json({ lesson, code }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "Informe um título válido." }, { status: 400 });
    const [message, status] = apiError(error); return NextResponse.json({ message }, { status });
  }
}
