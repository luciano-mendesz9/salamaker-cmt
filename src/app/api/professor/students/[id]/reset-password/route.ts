import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, requireTeacher } from "@/lib/authorization";
import { temporaryStudentPasswordData } from "@/lib/student-password";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const teacher = await requireTeacher();
    const { id } = await params;
    const passwordData = await temporaryStudentPasswordData();
    await prisma.$transaction([
      prisma.user.update({ where: { id, role: "STUDENT" }, data: passwordData }),
      prisma.auditLog.create({ data: { actorId: teacher.id, targetId: id, event: "PASSWORD_RESET", details: { mustChangePassword: true } } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const [message, status] = apiError(error);
    return NextResponse.json({ message }, { status });
  }
}
