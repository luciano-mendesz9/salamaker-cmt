import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudent } from "@/lib/authorization";
import { ludoApiError, ludoRoomDto, ludoTransaction } from "@/lib/ludo-api";
import { publishLudoEvent, roomChannel } from "@/lib/ludo-realtime";
import { moveLudoPiece } from "@/lib/ludo-service";
import { assertSameOrigin, consumeRateLimit } from "@/lib/request-security";
const input = z.object({ pieceIndex: z.number().int().min(0).max(3) });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const { student } = await requireStudent(); assertSameOrigin(request); const { id } = await params; await consumeRateLimit(`ludo:action:${student.id}`, 120, 60_000); const { pieceIndex } = input.parse(await request.json()); const room = await ludoTransaction(tx => moveLudoPiece(tx, student.id, id, pieceIndex)); await publishLudoEvent(roomChannel(id), { type: "room", roomId: id, userId: student.id, payload: { action: "moved" } }); return NextResponse.json({ room: ludoRoomDto(room, student.id) }); } catch (error) { return ludoApiError(error); } }
