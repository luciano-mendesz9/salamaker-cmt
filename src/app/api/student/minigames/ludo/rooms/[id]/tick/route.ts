import { NextResponse } from "next/server";
import { requireStudent } from "@/lib/authorization";
import { ludoApiError, ludoRoomDto, ludoTransaction } from "@/lib/ludo-api";
import { publishLudoEvent, roomChannel } from "@/lib/ludo-realtime";
import { getLudoRoom, tickLudoRoom } from "@/lib/ludo-service";
import { assertSameOrigin, consumeRateLimit } from "@/lib/request-security";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const { student } = await requireStudent(); assertSameOrigin(request); const { id } = await params; await consumeRateLimit(`ludo:tick:${student.id}`, 120, 60_000); await getLudoRoom((await import("@/lib/db")).prisma, student.id, id); const room = await ludoTransaction(tx => tickLudoRoom(tx, id)); await publishLudoEvent(roomChannel(id), { type: "room", roomId: id, payload: { action: "tick", version: room.version } }); return NextResponse.json({ room: ludoRoomDto(room, student.id) }); } catch (error) { return ludoApiError(error); } }
