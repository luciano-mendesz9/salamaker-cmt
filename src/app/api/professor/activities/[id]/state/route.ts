import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireTeacher } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { schoolLocalToUtc } from "@/lib/activities";

const input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("CLOSE") }),
  z.object({ action: z.literal("REOPEN"), closesAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/) }),
]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const teacher = await requireTeacher(); const { id } = await params; const body = input.parse(await request.json());
    const [activity, settings] = await Promise.all([prisma.activity.findUnique({ where: { id }, select: { id: true, opensAt: true, closesAt: true, manuallyClosedAt: true } }), prisma.appSetting.findUnique({ where: { id: 1 }, select: { timeZone: true } })]);
    if (!activity) return NextResponse.json({ message: "Atividade não encontrada." }, { status: 404 });
    const newClosesAt = body.action === "REOPEN" ? new Date(schoolLocalToUtc(body.closesAt, settings?.timeZone ?? "America/Fortaleza")) : null;
    if (newClosesAt && newClosesAt <= new Date()) return NextResponse.json({ message: "A nova data de fechamento deve estar no futuro." }, { status: 400 });
    await prisma.$transaction([
      prisma.activity.update({ where: { id }, data: body.action === "CLOSE" ? { manuallyClosedAt: new Date() } : { manuallyClosedAt: null, closesAt: newClosesAt! } }),
      prisma.auditLog.create({ data: { actorId: teacher.id, event: "ACTIVITY_STATE_CHANGED", details: { activityId: id, action: body.action, ...(newClosesAt ? { closesAt: newClosesAt.toISOString() } : {}) } } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "Ação de estado inválida." }, { status: 400 });
    const [message, status] = apiError(error); return NextResponse.json({ message }, { status });
  }
}
