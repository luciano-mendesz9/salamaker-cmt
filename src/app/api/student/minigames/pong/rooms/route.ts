import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireStudent } from "@/lib/authorization";
import { pongTransaction } from "@/lib/pong-api";
import { pongJsonError } from "@/lib/pong-http";
import { pongRoomChannel, publishPongEvent } from "@/lib/pong-realtime";
import { createPongRoom, getPongLobby, makePongRoomCode, pongRoomDto } from "@/lib/pong-service";
import { assertSameOrigin, consumeRateLimit } from "@/lib/request-security";

const createInput = z.object({ wager: z.number().int().min(10).max(100), requestId: z.string().uuid() });

export async function GET() {
  try {
    const { student } = await requireStudent();
    return NextResponse.json(await getPongLobby(student.id));
  } catch (error) {
    const [message, status] = apiError(error);
    return NextResponse.json({ message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const { student } = await requireStudent();
    assertSameOrigin(request);
    await consumeRateLimit(`pong:create:${student.id}`, 6, 10 * 60_000);
    const body = createInput.parse(await request.json());
    let result: Awaited<ReturnType<typeof createPongRoom>> | null = null;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        result = await pongTransaction((tx) => createPongRoom(tx, student.id, body.wager, body.requestId, makePongRoomCode()));
        break;
      } catch (error) {
        if ((error as { code?: string }).code === "P2002" && attempt < 5) continue;
        throw error;
      }
    }
    if (!result) throw new Error("ROOM_CODE_EXHAUSTED");
    const dto = pongRoomDto(result.room, student.id);
    await publishPongEvent(pongRoomChannel(result.room.id), { type: "room", roomId: result.room.id, userId: student.id, payload: { action: "created" } });
    return NextResponse.json({ room: dto, replayed: result.replayed }, { status: result.replayed ? 200 : 201 });
  } catch (error) {
    return pongJsonError(error);
  }
}
