import { randomUUID } from "node:crypto";
import { experimental_upgradeWebSocket, type WebSocketData } from "@vercel/functions";
import { requireStudent } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { ensurePongEngine } from "@/lib/pong-engine";
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
import { setPongPlayerConnection } from "@/lib/pong-service";
import { assertSameOrigin } from "@/lib/request-security";

export const maxDuration = 300;

export async function GET(request: Request) {
  assertSameOrigin(request);
  const { student } = await requireStudent();
  const connectionId = randomUUID();
  return experimental_upgradeWebSocket(async (ws) => {
    const send = (value: string) => {
      if (ws.readyState === ws.OPEN) ws.send(value);
    };
    const subscription = await subscribePongEvents([pongUserChannel(student.id)], send);
    let subscribedRoomId: string | null = null;
    let lastDatabaseHeartbeat = 0;
    send(JSON.stringify({ type: "ready", occurredAt: new Date().toISOString() }));

    ws.on("message", async (data: WebSocketData) => {
      if (typeof data !== "string" && !Buffer.isBuffer(data)) return;
      try {
        const message = JSON.parse(data.toString()) as { type?: string; roomId?: string; direction?: number };
        if (message.type === "subscribe-room" && typeof message.roomId === "string") {
          const membership = await prisma.pongPlayer.findFirst({
            where: { roomId: message.roomId, studentId: student.id, status: { in: ["WAITING", "PLAYING"] } },
            select: { roomId: true, room: { select: { status: true } } },
          });
          if (!membership) return;
          subscribedRoomId = membership.roomId;
          await subscription.subscribe(pongRoomChannel(membership.roomId));
          await touchPongConnection(membership.roomId, student.id, connectionId);
          await pongTransaction((tx) => setPongPlayerConnection(tx, student.id, membership.roomId, true));
          if (membership.room.status === "ACTIVE") ensurePongEngine(membership.roomId);
          await publishPongEvent(pongRoomChannel(membership.roomId), { type: "room", roomId: membership.roomId, userId: student.id, payload: { action: "connected" } });
        }
        if (message.type === "input" && subscribedRoomId && (message.direction === -1 || message.direction === 0 || message.direction === 1)) {
          await setPongInput(subscribedRoomId, student.id, message.direction);
        }
        if (message.type === "heartbeat") {
          if (subscribedRoomId) {
            await touchPongConnection(subscribedRoomId, student.id, connectionId);
            if (Date.now() - lastDatabaseHeartbeat > 15_000) {
              lastDatabaseHeartbeat = Date.now();
              await pongTransaction((tx) => setPongPlayerConnection(tx, student.id, subscribedRoomId!, true));
            }
          }
          send(JSON.stringify({ type: "heartbeat", occurredAt: new Date().toISOString() }));
        }
      } catch {
        send(JSON.stringify({ type: "error", payload: { message: "Mensagem do Pong inválida." }, occurredAt: new Date().toISOString() }));
      }
    });

    ws.on("close", async () => {
      await subscription.close().catch(() => undefined);
      if (!subscribedRoomId) return;
      const remaining = await removePongConnection(subscribedRoomId, student.id, connectionId).catch(() => 0);
      if (remaining === 0) await pongTransaction((tx) => setPongPlayerConnection(tx, student.id, subscribedRoomId!, false)).catch(() => undefined);
      await publishPongEvent(pongRoomChannel(subscribedRoomId), { type: "room", roomId: subscribedRoomId, userId: student.id, payload: { action: "disconnected" } }).catch(() => undefined);
    });
  }, { maxPayload: 2 * 1024 });
}
