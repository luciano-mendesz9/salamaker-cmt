import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudent } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { ludoApiError, ludoTransaction } from "@/lib/ludo-api";
import { onlineLudoStudentIds, publishLudoEvent, userChannel } from "@/lib/ludo-realtime";
import { inviteLudoStudent } from "@/lib/ludo-service";
import { assertSameOrigin, consumeRateLimit } from "@/lib/request-security";
const input = z.object({ inviteeId: z.string().uuid() });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { student } = await requireStudent(); assertSameOrigin(request); await consumeRateLimit(`ludo:invite:${student.id}`, 20, 10 * 60_000);
    const { id } = await params; const { inviteeId } = input.parse(await request.json());
    const online = await onlineLudoStudentIds();
    if (online.length && !online.includes(inviteeId)) return NextResponse.json({ message: "Esse aluno não está mais online." }, { status: 409 });
    if (!online.length) {
      const recent = await prisma.user.findFirst({ where: { id: inviteeId, lastSeenAt: { gte: new Date(Date.now() - 45_000) } }, select: { id: true } });
      if (!recent) return NextResponse.json({ message: "Esse aluno não está mais online." }, { status: 409 });
    }
    const result = await ludoTransaction(tx => inviteLudoStudent(tx, student.id, id, inviteeId));
    await publishLudoEvent(userChannel(inviteeId), { type: "invitation", roomId: id, userId: inviteeId, payload: { invitationId: result.invitation.id, roomCode: result.room.code, inviterName: `${student.firstName} ${student.lastName}`, wager: result.room.wager, expiresAt: result.invitation.expiresAt.toISOString() } });
    return NextResponse.json({ invitationId: result.invitation.id, chargedXp: result.chargedXp, remainingInBatch: result.remainingInBatch });
  } catch (error) { return ludoApiError(error); }
}
