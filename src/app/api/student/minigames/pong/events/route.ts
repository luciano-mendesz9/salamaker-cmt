import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudent } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { ensurePongEngine } from "@/lib/pong-engine";
import { pongJsonError } from "@/lib/pong-http";
import { pongTransaction } from "@/lib/pong-api";
import {
  pongRoomChannel,
  pongUserChannel,
  publishPongEvent,
  removePongConnection,
  setPongInput,
  subscribePongEvents,
  touchPongConnection,
} from "@/lib/pong-realtime";
import { PongError, setPongPlayerConnection } from "@/lib/pong-service";
import { assertSameOrigin } from "@/lib/request-security";

export const maxDuration = 300;

const roomIdSchema = z.string().uuid();
const inputSchema = z.object({ roomId: roomIdSchema, direction: z.union([z.literal(-1), z.literal(0), z.literal(1)]) });

async function requireMembership(studentId: string, roomId: string) {
  const [settings, membership] = await Promise.all([
    prisma.appSetting.findUnique({ where: { id: 1 }, select: { gamesEnabled: true } }),
    prisma.pongPlayer.findFirst({
      where: { roomId, studentId, status: { in: ["WAITING", "PLAYING"] } },
      select: { roomId: true, room: { select: { status: true } } },
    }),
  ]);
  if (!settings?.gamesEnabled) throw new PongError("GAMES_DISABLED");
  if (!membership) throw new PongError("NOT_A_PLAYER");
  return membership;
}

export async function GET(request: Request) {
  try {
    const { student } = await requireStudent();
    const roomId = roomIdSchema.parse(new URL(request.url).searchParams.get("roomId"));
    const membership = await requireMembership(student.id, roomId);
    const connectionId = randomUUID();
    const encoder = new TextEncoder();
    let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
    let closed = false;
    let heartbeatBusy = false;

    const send = (encoded: string) => {
      if (closed || !controller) return;
      try { controller.enqueue(encoder.encode(`data: ${encoded}\n\n`)); } catch { /* The browser closed the stream. */ }
    };
    const stream = new ReadableStream<Uint8Array>({
      start(value) { controller = value; },
      cancel() { void cleanup(); },
    });
    const subscription = await subscribePongEvents([pongUserChannel(student.id), pongRoomChannel(roomId)], send);

    await touchPongConnection(roomId, student.id, connectionId);
    await pongTransaction((tx) => setPongPlayerConnection(tx, student.id, roomId, true));
    if (membership.room.status === "ACTIVE") ensurePongEngine(roomId);
    send(JSON.stringify({ type: "ready", occurredAt: new Date().toISOString() }));
    await publishPongEvent(pongRoomChannel(roomId), { type: "room", roomId, userId: student.id, payload: { action: "connected" } });

    const heartbeat = setInterval(async () => {
      if (closed || heartbeatBusy) return;
      heartbeatBusy = true;
      try {
        await touchPongConnection(roomId, student.id, connectionId);
        await pongTransaction((tx) => setPongPlayerConnection(tx, student.id, roomId, true));
        send(JSON.stringify({ type: "heartbeat", occurredAt: new Date().toISOString() }));
      } catch { /* A later refresh or reconnect will recover presence. */ }
      finally { heartbeatBusy = false; }
    }, 15_000);

    async function cleanup() {
      if (closed) return;
      closed = true;
      clearInterval(heartbeat);
      await subscription.close().catch(() => undefined);
      const remaining = await removePongConnection(roomId, student.id, connectionId).catch(() => 0);
      if (remaining === 0) await pongTransaction((tx) => setPongPlayerConnection(tx, student.id, roomId, false)).catch(() => undefined);
      await publishPongEvent(pongRoomChannel(roomId), { type: "room", roomId, userId: student.id, payload: { action: "disconnected" } }).catch(() => undefined);
      try { controller?.close(); } catch { /* The stream may already be cancelled. */ }
    }

    request.signal.addEventListener("abort", () => void cleanup(), { once: true });
    return new Response(stream, {
      headers: {
        "Cache-Control": "no-cache, no-transform",
        "Content-Type": "text/event-stream; charset=utf-8",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return pongJsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { student } = await requireStudent();
    const body = inputSchema.parse(await request.json());
    const membership = await requireMembership(student.id, body.roomId);
    await touchPongConnection(body.roomId, student.id, `http:${student.id}`);
    await setPongInput(body.roomId, student.id, body.direction);
    if (membership.room.status === "ACTIVE") ensurePongEngine(body.roomId);
    return NextResponse.json({ accepted: true });
  } catch (error) {
    return pongJsonError(error);
  }
}
