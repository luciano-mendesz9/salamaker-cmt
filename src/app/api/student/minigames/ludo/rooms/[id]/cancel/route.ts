import { NextResponse } from "next/server";
import { requireStudent } from "@/lib/authorization";
import { ludoApiError, ludoRoomDto, ludoTransaction } from "@/lib/ludo-api";
import { publishLudoEvent, roomChannel } from "@/lib/ludo-realtime";
import { cancelLudoRoom } from "@/lib/ludo-service";
import { assertSameOrigin } from "@/lib/request-security";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const { student } = await requireStudent(); assertSameOrigin(request); const { id } = await params; const room = await ludoTransaction(tx => cancelLudoRoom(tx, student.id, id)); await publishLudoEvent(roomChannel(id), { type: "room", roomId: id, payload: { action: "cancelled" } }); return NextResponse.json({ room: ludoRoomDto(room, student.id) }); } catch (error) { return ludoApiError(error); } }
