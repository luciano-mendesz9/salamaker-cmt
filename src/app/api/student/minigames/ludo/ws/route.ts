import { experimental_upgradeWebSocket, type WebSocketData } from "@vercel/functions";
import { requireStudent } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { LUDO_CHAT_MESSAGES, type LudoChatKey } from "@/lib/ludo-chat";
import { ludoTransaction } from "@/lib/ludo-api";
import { markLudoPresence, publishLudoEvent, removeLudoPresence, roomChannel, subscribeLudoEvents, userChannel } from "@/lib/ludo-realtime";
import { LUDO_DISCONNECT_GRACE_MS } from "@/lib/ludo-rules";
import { tickLudoRoom } from "@/lib/ludo-service";
import { assertSameOrigin } from "@/lib/request-security";

export const maxDuration = 300;

export async function GET(request: Request) {
  assertSameOrigin(request);
  const { student } = await requireStudent();
  return experimental_upgradeWebSocket(async ws => {
    const send = (value: string) => {
      if (ws.readyState === ws.OPEN) ws.send(value);
    };
    const subscription = await subscribeLudoEvents([userChannel(student.id), "ludo:presence-events"], send);
    await markLudoPresence(student.id);
    await prisma.user.update({ where: { id: student.id }, data: { lastSeenAt: new Date() } });
    const overdueRooms = await prisma.ludoPlayer.findMany({ where: { studentId: student.id, status: "PLAYING", disconnectedAt: { lte: new Date(Date.now() - LUDO_DISCONNECT_GRACE_MS) }, room: { status: "ACTIVE" } }, select: { roomId: true } });
    for (const { roomId } of overdueRooms) {
      await ludoTransaction(tx => tickLudoRoom(tx, roomId));
      await publishLudoEvent(roomChannel(roomId), { type: "room", roomId, userId: student.id, payload: { action: "disconnect-timeout" } });
    }
    await prisma.ludoPlayer.updateMany({
      where: { studentId: student.id, status: { in: ["JOINED", "PLAYING"] }, room: { status: { in: ["WAITING", "ACTIVE", "PAUSED"] } } },
      data: { connected: true, disconnectedAt: null, lastSeenAt: new Date() },
    });
    send(JSON.stringify({ type: "ready", occurredAt: new Date().toISOString() }));

    let lastChatAt = 0;
    ws.on("message", async (data: WebSocketData) => {
      if (typeof data !== "string" && !Buffer.isBuffer(data)) return;
      try {
        const message = JSON.parse(data.toString()) as { type?: string; roomId?: string; key?: string };
        if (message.type === "heartbeat") {
          await markLudoPresence(student.id);
          await prisma.user.update({ where: { id: student.id }, data: { lastSeenAt: new Date() } });
          await prisma.ludoPlayer.updateMany({ where: { studentId: student.id, status: { in: ["JOINED", "PLAYING"] }, room: { status: { in: ["WAITING", "ACTIVE", "PAUSED"] } } }, data: { connected: true, disconnectedAt: null, lastSeenAt: new Date() } });
          send(JSON.stringify({ type: "heartbeat", occurredAt: new Date().toISOString() }));
        }
        if (message.type === "subscribe-room" && typeof message.roomId === "string") {
          const membership = await prisma.ludoPlayer.findFirst({ where: { roomId: message.roomId, studentId: student.id }, select: { id: true } });
          if (membership) await subscription.subscribe(roomChannel(message.roomId));
        }
        if (message.type === "chat" && typeof message.roomId === "string" && typeof message.key === "string") {
          const key = message.key as LudoChatKey;
          if (!LUDO_CHAT_MESSAGES[key] || Date.now() - lastChatAt < 1_000) return;
          const membership = await prisma.ludoPlayer.findFirst({ where: { roomId: message.roomId, studentId: student.id, room: { status: { in: ["WAITING", "ACTIVE", "PAUSED"] } } }, select: { id: true } });
          if (!membership) return;
          lastChatAt = Date.now();
          await publishLudoEvent(roomChannel(message.roomId), { type: "chat", roomId: message.roomId, userId: student.id, payload: { key, text: LUDO_CHAT_MESSAGES[key], sender: student.firstName } });
        }
      } catch {
        send(JSON.stringify({ type: "error", payload: { message: "Mensagem em tempo real inválida." }, occurredAt: new Date().toISOString() }));
      }
    });

    ws.on("close", async () => {
      await subscription.close().catch(() => undefined);
      await removeLudoPresence(student.id).catch(() => undefined);
      await prisma.ludoPlayer.updateMany({
        where: { studentId: student.id, status: { in: ["JOINED", "PLAYING"] }, room: { status: { in: ["WAITING", "ACTIVE", "PAUSED"] } } },
        data: { connected: false, disconnectedAt: new Date() },
      }).catch(() => undefined);
    });
  }, { maxPayload: 4 * 1024 });
}
