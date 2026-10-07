import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudent } from "@/lib/authorization";
import { pongTransaction } from "@/lib/pong-api";
import { pongJsonError } from "@/lib/pong-http";
import { pongRoomChannel, pongUserChannel, publishPongEvent } from "@/lib/pong-realtime";
import { pongRoomDto, respondToPongJoin } from "@/lib/pong-service";
import { assertSameOrigin } from "@/lib/request-security";

const input = z.object({ accept: z.boolean() });

export async function PATCH(request: Request, context: { params: Promise<{ id: string; requestId: string }> }) {
  try {
    const { student } = await requireStudent();
    assertSameOrigin(request);
    const [{ id, requestId }, body] = await Promise.all([context.params, request.json().then((value) => input.parse(value))]);
    const result = await pongTransaction((tx) => respondToPongJoin(tx, student.id, id, requestId, body.accept));
    const targetId = result.room.players.find((player) => player.seat === "GUEST")?.studentId
      ?? result.room.joinRequests.find((item) => item.id === requestId)?.studentId;
    await Promise.all([
      publishPongEvent(pongRoomChannel(id), { type: "room", roomId: id, userId: student.id, payload: { action: body.accept ? "approved" : "declined" } }),
      targetId ? publishPongEvent(pongUserChannel(targetId), { type: "room", roomId: id, userId: student.id, payload: { action: body.accept ? "approved" : "declined" } }) : Promise.resolve(),
    ]);
    return NextResponse.json({ accepted: result.accepted, room: pongRoomDto(result.room, student.id) });
  } catch (error) {
    return pongJsonError(error);
  }
}
