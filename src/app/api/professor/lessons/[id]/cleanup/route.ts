import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { apiError, requireTeacher } from "@/lib/authorization";
import { cleanupCandidatePool } from "@/lib/cleanup-draw";
import { prisma } from "@/lib/db";
import { getSchoolMonth } from "@/lib/school-day";

const CLEANUP_STUDENTS_PER_LESSON = 3;
const CLEANUP_INTERVAL_MS = 15 * 24 * 60 * 60 * 1000;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const teacher = await requireTeacher();
    const { id } = await params;
    let result: { assignment: { id: string; confirmedAt: Date; student: { id: string; firstName: string; lastName: string } }; count: number; strategy: "FIRST_THIS_MONTH" | "FIFTEEN_DAY_INTERVAL" } | undefined;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        result = await prisma.$transaction(async (tx) => {
          const lesson = await tx.lesson.findUnique({
            where: { id },
            select: {
              attendances: {
                where: { status: "PRESENT", student: { role: "STUDENT", status: "ACTIVE" } },
                select: { student: { select: { id: true, firstName: true, lastName: true } } },
              },
              cleanups: { select: { studentId: true } },
            },
          });
          if (!lesson) throw new Error("CLEANUP_LESSON_NOT_FOUND");
          if (lesson.cleanups.length >= CLEANUP_STUDENTS_PER_LESSON) throw new Error("CLEANUP_LIMIT_REACHED");

          const assignedIds = new Set(lesson.cleanups.map((assignment) => assignment.studentId));
          const presentStudents = lesson.attendances.map((attendance) => attendance.student).filter((student) => !assignedIds.has(student.id));
          if (!presentStudents.length) throw new Error("NO_PRESENT_CLEANUP_STUDENTS");

          const histories = await tx.cleanupAssignment.findMany({
            where: { studentId: { in: presentStudents.map((student) => student.id) } },
            select: { studentId: true, confirmedAt: true },
            orderBy: { confirmedAt: "desc" },
          });
          const lastCleanupByStudent = new Map<string, Date>();
          for (const history of histories) if (!lastCleanupByStudent.has(history.studentId)) lastCleanupByStudent.set(history.studentId, history.confirmedAt);

          const now = new Date();
          const pool = cleanupCandidatePool(
            presentStudents.map((student) => ({ id: student.id, lastCleanupAt: lastCleanupByStudent.get(student.id) ?? null })),
            getSchoolMonth(now).start,
            new Date(now.getTime() - CLEANUP_INTERVAL_MS),
          );
          if (!pool.candidates.length) throw new Error("NO_ELIGIBLE_CLEANUP_STUDENTS");

          const selected = pool.candidates[randomInt(pool.candidates.length)];
          const assignment = await tx.cleanupAssignment.create({
            data: { lessonId: id, studentId: selected.id, confirmedBy: teacher.id },
            select: { id: true, confirmedAt: true, student: { select: { id: true, firstName: true, lastName: true } } },
          });
          return { assignment, count: lesson.cleanups.length + 1, strategy: pool.strategy };
        }, { isolationLevel: "Serializable", maxWait: 10_000, timeout: 20_000 });
        break;
      } catch (error) {
        const code = (error as { code?: string }).code;
        if ((code === "P2034" || code === "P2002") && attempt < 2) continue;
        throw error;
      }
    }

    if (!result) throw new Error("TRANSACTION_RETRY_EXHAUSTED");
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "CLEANUP_LESSON_NOT_FOUND") return NextResponse.json({ message: "Aula não encontrada." }, { status: 404 });
    if (error instanceof Error && error.message === "CLEANUP_LIMIT_REACHED") return NextResponse.json({ message: "Os três alunos da faxina desta aula já foram sorteados." }, { status: 409 });
    if (error instanceof Error && error.message === "NO_PRESENT_CLEANUP_STUDENTS") return NextResponse.json({ message: "Não há outro aluno presente disponível para a faxina." }, { status: 409 });
    if (error instanceof Error && error.message === "NO_ELIGIBLE_CLEANUP_STUDENTS") return NextResponse.json({ message: "Todos os alunos presentes participaram da faxina nos últimos 15 dias." }, { status: 409 });
    const [message, status] = apiError(error);
    return NextResponse.json({ message }, { status });
  }
}
