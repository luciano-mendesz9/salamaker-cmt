import { NextResponse } from "next/server";
import { requireStudent } from "@/lib/authorization";
import { ludoApiError, ludoRoomDto, ludoTransaction } from "@/lib/ludo-api";
import { publishLudoEvent, roomChannel } from "@/lib/ludo-realtime";
import { pauseOrRequestLudoRoom } from "@/lib/ludo-service";
import { assertSameOrigin, consumeRateLimit } from "@/lib/request-security";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const { student } = await requireStudent(); assertSameOrigin(request); const { id } = await params; await consumeRateLimit(`ludo:pause:${student.id}`, 6, 60_000); const result = await ludoTransaction(tx => pauseOrRequestLudoRoom(tx, student.id, id)); await publishLudoEvent(roomChannel(id), { type: "room", roomId: id, userId: student.id, payload: { action: result.paused ? "paused" : "pause-requested", requestCount: result.requestCount } }); return NextResponse.json({ room: ludoRoomDto(result.room, student.id), paused: result.paused, requestCount: result.requestCount }); } catch (error) { return ludoApiError(error); } }
