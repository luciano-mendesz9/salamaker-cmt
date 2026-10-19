import { NextResponse } from "next/server";
import { requireStudent } from "@/lib/authorization";
import { ludoApiError, ludoRoomDto, ludoTransaction } from "@/lib/ludo-api";
import { publishLudoEvent, roomChannel } from "@/lib/ludo-realtime";
import { rollLudoTurn } from "@/lib/ludo-service";
import { assertSameOrigin, consumeRateLimit } from "@/lib/request-security";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const { student } = await requireStudent(); assertSameOrigin(request); const { id } = await params; await consumeRateLimit(`ludo:action:${student.id}`, 120, 60_000); const result = await ludoTransaction(tx => rollLudoTurn(tx, student.id, id)); await publishLudoEvent(roomChannel(id), { type: "room", roomId: id, userId: student.id, payload: { action: "rolled", roll: result.roll } }); return NextResponse.json({ room: ludoRoomDto(result.room, student.id), roll: result.roll }); } catch (error) { return ludoApiError(error); } }
