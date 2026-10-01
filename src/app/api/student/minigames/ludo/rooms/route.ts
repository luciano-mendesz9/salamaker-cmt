import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudent } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { ludoApiError, ludoRoomDto, ludoTransaction } from "@/lib/ludo-api";
import { ludoRealtimeConfigured, publishLudoEvent, roomChannel } from "@/lib/ludo-realtime";
import { createLudoRoom } from "@/lib/ludo-service";
import { assertSameOrigin, consumeRateLimit } from "@/lib/request-security";

const input = z.object({ mode: z.enum(["HUMAN", "BOT"]), wager: z.number().int().min(10).max(100), requestId: z.string().uuid() });

export async function GET() {
  try {
    const { student } = await requireStudent();
    const [rooms, invitations] = await Promise.all([
      prisma.ludoRoom.findMany({
        where: { players: { some: { studentId: student.id } } },
        include: { owner: { select: { id: true, firstName: true, lastName: true } }, players: { orderBy: { seat: "asc" }, include: { student: { select: { id: true, firstName: true, lastName: true, profileAvatar: true, xp: true, devCoins: true } } } }, moves: { orderBy: { sequence: "desc" }, take: 12 } },
        orderBy: { updatedAt: "desc" }, take: 30,
      }),
      prisma.ludoInvitation.findMany({ where: { inviteeId: student.id, status: "PENDING", expiresAt: { gt: new Date() }, room: { status: "WAITING" } }, include: { inviter: { select: { firstName: true, lastName: true } }, room: { select: { code: true, wager: true, players: { select: { id: true } } } } }, orderBy: { createdAt: "desc" } }),
    ]);
    return NextResponse.json({ rooms: rooms.map(room => ludoRoomDto(room, student.id)), invitations: invitations.map(item => ({ id: item.id, inviterName: `${item.inviter.firstName} ${item.inviter.lastName}`, roomCode: item.room.code, wager: item.room.wager, players: item.room.players.length, expiresAt: item.expiresAt.toISOString() })), realtimeConfigured: ludoRealtimeConfigured() });
  } catch (error) { return ludoApiError(error); }
}

export async function POST(request: Request) {
  try {
    const { student } = await requireStudent();
    assertSameOrigin(request);
    if (process.env.NODE_ENV === "production" && !ludoRealtimeConfigured()) throw new Error("LUDO_REALTIME_NOT_CONFIGURED");
    await consumeRateLimit(`ludo:create:${student.id}`, 8, 10 * 60_000);
    const body = input.parse(await request.json());
    let result;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        result = await ludoTransaction(tx => createLudoRoom(tx, student.id, body.mode, body.wager, body.requestId));
        break;
      } catch (error) {
        if ((error as { code?: string }).code === "P2002" && attempt < 2) continue;
        throw error;
      }
    }
    if (!result) throw new Error("ROOM_CREATE_RETRY_EXHAUSTED");
    await publishLudoEvent(roomChannel(result.room.id), { type: "room", roomId: result.room.id, payload: { action: "created" } });
    return NextResponse.json({ room: ludoRoomDto(result.room, student.id), replayed: result.replayed }, { status: result.replayed ? 200 : 201 });
  } catch (error) { return ludoApiError(error); }
}
