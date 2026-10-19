import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudent } from "@/lib/authorization";
import { ludoApiError, ludoRoomDto, ludoTransaction } from "@/lib/ludo-api";
import { publishLudoEvent, roomChannel } from "@/lib/ludo-realtime";
import { getLudoRoomByCode, joinLudoRoom } from "@/lib/ludo-service";
import { assertSameOrigin, consumeRateLimit } from "@/lib/request-security";

const input = z.object({ code: z.string().trim().min(6).max(6).transform(value => value.toUpperCase()) });
export async function POST(request: Request) {
  try {
    const { student } = await requireStudent(); assertSameOrigin(request); await consumeRateLimit(`ludo:join:${student.id}`, 20, 10 * 60_000);
    const { code } = input.parse(await request.json());
    const result = await ludoTransaction(async tx => { const room = await getLudoRoomByCode(tx, code); return joinLudoRoom(tx, student.id, room.id); });
    await publishLudoEvent(roomChannel(result.room.id), { type: "room", roomId: result.room.id, userId: student.id, payload: { action: "joined" } });
    return NextResponse.json({ room: ludoRoomDto(result.room, student.id), replayed: result.replayed });
  } catch (error) { return ludoApiError(error); }
}
