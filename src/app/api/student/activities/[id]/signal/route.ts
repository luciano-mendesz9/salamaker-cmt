import { NextResponse } from "next/server";
import { apiError, requireStudent } from "@/lib/authorization";
import { assertOpenForSubmission } from "@/lib/activities";
import { prisma } from "@/lib/db";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { student } = await requireStudent(); const { id } = await params;
    const recipient = await prisma.activityRecipient.findUnique({ where: { activityId_studentId: { activityId: id, studentId: student.id } }, include: { activity: true } });
    if (!recipient || recipient.activity.type !== "EXTERNAL_LINK") return NextResponse.json({ message: "Atividade não encontrada." }, { status: 404 });
    assertOpenForSubmission(recipient.activity);
    await prisma.activityRecipient.update({ where: { id: recipient.id }, data: { studentSignaledAt: recipient.studentSignaledAt ?? new Date() } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "ACTIVITY_NOT_OPEN") return NextResponse.json({ message: "A atividade não está aberta para confirmação." }, { status: 409 });
    const [message, status] = apiError(error); return NextResponse.json({ message }, { status });
  }
}
