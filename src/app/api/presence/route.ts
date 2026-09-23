import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const schema = z.object({ accessCode: z.string().trim().toUpperCase(), lessonCode: z.string().regex(/^\d{6}$/) });

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const settings = await prisma.appSetting.findUnique({ where: { id: 1 } });
    if (settings && !settings.studentAreaEnabled) return NextResponse.json({ message: "O site foi desativado temporariamente pelo professor." }, { status: 403 });
    const student = await prisma.user.findFirst({ where: { accessCode: body.accessCode, role: "STUDENT", status: "ACTIVE" } });
    const lessons = await prisma.lesson.findMany({ where: { status: "OPEN" } });
    let lesson = null;
    for (const candidate of lessons) if (await compare(body.lessonCode, candidate.presenceCodeHash)) { lesson = candidate; break; }
    if (!student || !lesson) return NextResponse.json({ message: "Não foi possível confirmar a presença com esses dados." }, { status: 400 });
    const participant = await prisma.lessonParticipant.findUnique({ where: { lessonId_studentId: { lessonId: lesson.id, studentId: student.id } }, select: { id: true } });
    if (!participant) return NextResponse.json({ message: "Você não estava entre os participantes desta aula quando ela foi aberta." }, { status: 403 });
    const existing = await prisma.attendance.findUnique({ where: { lessonId_studentId: { lessonId: lesson.id, studentId: student.id } } });
    if (existing) return NextResponse.json({ message: "Sua presença já foi registrada." }, { status: 409 });
    await prisma.attendance.create({ data: { lessonId: lesson.id, studentId: student.id, status: "PRESENT" } });
    return NextResponse.json({ message: "Presença confirmada! O XP será aplicado no fechamento da aula." });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "Informe o código do aluno e os seis dígitos da aula." }, { status: 400 });
    return NextResponse.json({ message: "Não foi possível registrar a presença." }, { status: 500 });
  }
}
