import { NextResponse } from "next/server";
import { requireStudent } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { ludoApiError } from "@/lib/ludo-api";
import { ludoRealtimeConfigured, markLudoPresence, onlineLudoStudentIds } from "@/lib/ludo-realtime";

export async function GET() {
  try {
    const { student } = await requireStudent(); await markLudoPresence(student.id);
    const ids = await onlineLudoStudentIds();
    const students = await prisma.user.findMany({ where: ids.length ? { role: "STUDENT", status: "ACTIVE", id: { in: ids, not: student.id } } : { role: "STUDENT", status: "ACTIVE", id: { not: student.id }, lastSeenAt: { gte: new Date(Date.now() - 45_000) } }, select: { id: true, firstName: true, lastName: true, profileAvatar: true }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }] });
    return NextResponse.json({ students, realtimeConfigured: ludoRealtimeConfigured() });
  } catch (error) { return ludoApiError(error); }
}
