import { NextResponse } from "next/server";
import { requireStudent } from "@/lib/authorization";
import { ludoApiError, ludoRoomDto, ludoTransaction } from "@/lib/ludo-api";
import { publishLudoEvent, roomChannel } from "@/lib/ludo-realtime";
import { forfeitLudoPlayer } from "@/lib/ludo-service";
import { assertSameOrigin } from "@/lib/request-security";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const { student } = await requireStudent(); assertSameOrigin(request); const { id } = await params; const room = await ludoTransaction(tx => forfeitLudoPlayer(tx, student.id, id, "QUIT")); await publishLudoEvent(roomChannel(id), { type: "room", roomId: id, userId: student.id, payload: { action: "forfeited" } }); return NextResponse.json({ room: ludoRoomDto(room, student.id) }); } catch (error) { return ludoApiError(error); } }
