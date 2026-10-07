import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudent } from "@/lib/authorization";
import { pongTransaction } from "@/lib/pong-api";
import { pongJsonError } from "@/lib/pong-http";
import { pongRoomChannel, pongUserChannel, publishPongEvent } from "@/lib/pong-realtime";
import { requestPongJoin } from "@/lib/pong-service";
import { assertSameOrigin, consumeRateLimit } from "@/lib/request-security";

const input = z.object({ code: z.string().regex(/^\d{6}$/), requestId: z.string().uuid() });

export async function POST(request: Request) {
  try {
    const { student } = await requireStudent();
    assertSameOrigin(request);
    await consumeRateLimit(`pong:join:${student.id}`, 12, 10 * 60_000);
    const body = input.parse(await request.json());
    const result = await pongTransaction((tx) => requestPongJoin(tx, student.id, body.code, body.requestId));
    await Promise.all([
      publishPongEvent(pongRoomChannel(result.request.roomId), { type: "join-request", roomId: result.request.roomId, userId: student.id, payload: { requestId: result.request.id } }),
      publishPongEvent(pongUserChannel(student.id), { type: "room", roomId: result.request.roomId, userId: student.id, payload: { action: "join-requested" } }),
    ]);
    return NextResponse.json({ requestId: result.request.id, roomId: result.request.roomId, expiresAt: result.request.expiresAt.toISOString(), replayed: result.replayed }, { status: result.replayed ? 200 : 201 });
  } catch (error) {
    return pongJsonError(error);
  }
}
