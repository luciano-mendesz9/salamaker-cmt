import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { pongTransaction } from "@/lib/pong-api";
import {
  acquirePongAuthority,
  getPongInputs,
  loadPongState,
  pongConnectionCount,
  pongRoomChannel,
  publishPongEvent,
  releasePongAuthority,
  renewPongAuthority,
  savePongState,
} from "@/lib/pong-realtime";
import { createPongPhysicsState, stepPongPhysics, type PongPhysicsState } from "@/lib/pong-rules";
import { recordPongPoint, setPongPlayerConnection, settleExpiredPongDisconnect } from "@/lib/pong-service";

type Loop = { timer: ReturnType<typeof setInterval>; token: string; authority: boolean; busy: boolean };
const globalEngine = globalThis as unknown as { pongLoops?: Map<string, Loop> };

function loops() {
  globalEngine.pongLoops ??= new Map();
  return globalEngine.pongLoops;
}

async function stop(roomId: string) {
  const loop = loops().get(roomId);
  if (!loop) return;
  clearInterval(loop.timer);
  loops().delete(roomId);
  if (loop.authority) await releasePongAuthority(roomId, loop.token).catch(() => undefined);
}

export function ensurePongEngine(roomId: string) {
  if (loops().has(roomId)) return;
  const token = randomUUID();
  let state: PongPhysicsState | null = null;
  let ownerId = "";
  let guestId = "";
  let lastTick = Date.now();
  let lastInputRead = 0;
  let lastBroadcast = 0;
  let lastAuthorityAttempt = 0;
  let lastAuthorityRenew = 0;
  let lastPresenceCheck = 0;
  let inputs = { owner: 0 as -1 | 0 | 1, guest: 0 as -1 | 0 | 1 };
  const loop: Loop = { token, authority: false, busy: false, timer: setInterval(() => undefined, 2 ** 30) };

  const run = async () => {
    if (loop.busy) return;
    loop.busy = true;
    try {
      const now = Date.now();
      if (!loop.authority && now - lastAuthorityAttempt >= 1_000) {
        lastAuthorityAttempt = now;
        loop.authority = await acquirePongAuthority(roomId, token);
      }
      if (!loop.authority) return;
      if (now - lastAuthorityRenew >= 1_000) {
        lastAuthorityRenew = now;
        loop.authority = await renewPongAuthority(roomId, token);
        if (!loop.authority) return;
      }

      if (!state || !ownerId || !guestId) {
        const room = await prisma.pongRoom.findUnique({
          where: { id: roomId },
          select: { status: true, ownerScore: true, guestScore: true, scoreSequence: true, players: { select: { studentId: true, seat: true } } },
        });
        if (!room || room.status !== "ACTIVE") return void stop(roomId);
        ownerId = room.players.find((player) => player.seat === "OWNER")?.studentId ?? "";
        guestId = room.players.find((player) => player.seat === "GUEST")?.studentId ?? "";
        if (!ownerId || !guestId) return void stop(roomId);
        state = await loadPongState(roomId) ?? createPongPhysicsState(room.ownerScore, room.guestScore, room.scoreSequence);
        if (state.scoreSequence !== room.scoreSequence) state = createPongPhysicsState(room.ownerScore, room.guestScore, room.scoreSequence);
        lastTick = now;
      }

      if (now - lastInputRead >= 100) {
        lastInputRead = now;
        inputs = await getPongInputs(roomId, ownerId, guestId);
      }
      const deltaMs = Math.min(50, Math.max(1, now - lastTick));
      lastTick = now;
      const result = stepPongPhysics(state, deltaMs, inputs);
      state = result.state;

      if (result.scored) {
        const room = await pongTransaction((tx) => recordPongPoint(tx, roomId, result.scored!, state!.scoreSequence));
        state.ownerScore = room.ownerScore;
        state.guestScore = room.guestScore;
        state.scoreSequence = room.scoreSequence;
        if (room.status === "FINISHED") {
          await savePongState(roomId, state);
          await publishPongEvent(pongRoomChannel(roomId), { type: "result", roomId, payload: { status: room.status, winnerId: room.winnerId, finishReason: room.finishReason } });
          return void stop(roomId);
        }
      }

      if (now - lastBroadcast >= 50) {
        lastBroadcast = now;
        await savePongState(roomId, state);
        await publishPongEvent(pongRoomChannel(roomId), { type: "frame", roomId, payload: state });
      }

      if (now - lastPresenceCheck >= 5_000) {
        lastPresenceCheck = now;
        for (const studentId of [ownerId, guestId]) {
          const count = await pongConnectionCount(roomId, studentId);
          const player = await prisma.pongPlayer.findFirst({ where: { roomId, studentId }, select: { connected: true, disconnectedAt: true } });
          if (player && ((count > 0 && !player.connected) || (count === 0 && (player.connected || !player.disconnectedAt)))) {
            await pongTransaction((tx) => setPongPlayerConnection(tx, studentId, roomId, count > 0));
          }
        }
        const checked = await pongTransaction((tx) => settleExpiredPongDisconnect(tx, roomId));
        if (checked.status === "FINISHED") {
          await publishPongEvent(pongRoomChannel(roomId), { type: "result", roomId, payload: { status: checked.status, winnerId: checked.winnerId, finishReason: checked.finishReason } });
          return void stop(roomId);
        }
      }
    } catch (error) {
      state = null;
      console.error("Pong engine:", error);
    } finally {
      loop.busy = false;
    }
  };

  loop.timer = setInterval(() => void run(), 33);
  loops().set(roomId, loop);
  void run();
}
