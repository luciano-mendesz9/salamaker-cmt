import { NextResponse } from "next/server";
import { apiError, requireStudent } from "@/lib/authorization";
import { effectiveActivityState } from "@/lib/activities";
import { prisma } from "@/lib/db";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { student } = await requireStudent();
    const { id } = await params;
    const recipient = await prisma.activityRecipient.findUnique({
      where: { activityId_studentId: { activityId: id, studentId: student.id } },
      include: { activity: true, submission: { select: { id: true } } },
    });
    if (!recipient || recipient.activity.type !== "CPP_CODE") return NextResponse.json({ message: "Atividade não encontrada." }, { status: 404 });
    if (effectiveActivityState(recipient.activity) !== "OPEN" || recipient.submission) return NextResponse.json({ message: "A edição não está disponível." }, { status: 409 });
    await prisma.activityRecipient.updateMany({ where: { id: recipient.id, codingStartedAt: null }, data: { codingStartedAt: new Date() } });
    return NextResponse.json({ ready: true });
  } catch (error) {
    const [message, status] = apiError(error);
    return NextResponse.json({ message }, { status });
  }
}
