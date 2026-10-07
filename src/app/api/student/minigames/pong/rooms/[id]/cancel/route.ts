import { NextResponse } from "next/server";
import { requireStudent } from "@/lib/authorization";
import { pongTransaction } from "@/lib/pong-api";
import { pongJsonError } from "@/lib/pong-http";
import { pongRoomChannel, publishPongEvent } from "@/lib/pong-realtime";
import { cancelPongRoom, pongRoomDto } from "@/lib/pong-service";
import { assertSameOrigin } from "@/lib/request-security";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { student } = await requireStudent();
    assertSameOrigin(request);
    const { id } = await context.params;
    const room = await pongTransaction((tx) => cancelPongRoom(tx, student.id, id));
    await publishPongEvent(pongRoomChannel(id), { type: "room", roomId: id, userId: student.id, payload: { action: "cancelled" } });
    return NextResponse.json({ room: pongRoomDto(room, student.id) });
  } catch (error) {
    return pongJsonError(error);
  }
}
