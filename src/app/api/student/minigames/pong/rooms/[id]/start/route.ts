import { NextResponse } from "next/server";
import { requireStudent } from "@/lib/authorization";
import { ensurePongEngine } from "@/lib/pong-engine";
import { pongTransaction } from "@/lib/pong-api";
import { pongJsonError } from "@/lib/pong-http";
import { pongRoomChannel, publishPongEvent } from "@/lib/pong-realtime";
import { pongRoomDto, startPongRoom } from "@/lib/pong-service";
import { assertSameOrigin } from "@/lib/request-security";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { student } = await requireStudent();
    assertSameOrigin(request);
    const { id } = await context.params;
    const room = await pongTransaction((tx) => startPongRoom(tx, student.id, id));
    ensurePongEngine(id);
    await publishPongEvent(pongRoomChannel(id), { type: "room", roomId: id, userId: student.id, payload: { action: "started" } });
    return NextResponse.json({ room: pongRoomDto(room, student.id) });
  } catch (error) {
    return pongJsonError(error);
  }
}
