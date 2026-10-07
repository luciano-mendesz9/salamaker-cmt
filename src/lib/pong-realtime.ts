import { EventEmitter } from "node:events";
import { createClient, type RedisClientType } from "redis";
import type { PongInput, PongPhysicsState } from "@/lib/pong-rules";

export type PongRealtimeEvent = {
  type: "room" | "join-request" | "frame" | "result" | "ready" | "heartbeat" | "error";
  roomId?: string;
  userId?: string;
  payload?: unknown;
  occurredAt: string;
};

const redisUrl = process.env.REDIS_URL ?? process.env.KV_URL;
const globalPongRealtime = globalThis as unknown as {
  pongPublisher?: RedisClientType;
  pongLocalBus?: EventEmitter;
  pongLocalInputs?: Map<string, Map<string, { direction: PongInput; at: number }>>;
  pongLocalStates?: Map<string, PongPhysicsState>;
  pongLocalConnections?: Map<string, Map<string, number>>;
  pongLocalLocks?: Map<string, { token: string; expiresAt: number }>;
};

function localBus() {
  globalPongRealtime.pongLocalBus ??= new EventEmitter().setMaxListeners(300);
  return globalPongRealtime.pongLocalBus;
}

function localInputs() {
  globalPongRealtime.pongLocalInputs ??= new Map();
  return globalPongRealtime.pongLocalInputs;
}

function localStates() {
  globalPongRealtime.pongLocalStates ??= new Map();
  return globalPongRealtime.pongLocalStates;
}

function localConnections() {
  globalPongRealtime.pongLocalConnections ??= new Map();
  return globalPongRealtime.pongLocalConnections;
}

function localLocks() {
  globalPongRealtime.pongLocalLocks ??= new Map();
  return globalPongRealtime.pongLocalLocks;
}

async function publisher() {
  if (!redisUrl) return null;
  if (!globalPongRealtime.pongPublisher) {
    const client = createClient({ url: redisUrl });
    client.on("error", (error) => console.error("Redis Pong publisher:", error));
    globalPongRealtime.pongPublisher = client as RedisClientType;
  }
  const client = globalPongRealtime.pongPublisher;
  if (!client.isOpen) await client.connect();
  return client;
}

export function pongRealtimeConfigured() {
  return Boolean(redisUrl);
}

export function pongRoomChannel(roomId: string) {
  return `pong:room:${roomId}`;
}

export function pongUserChannel(userId: string) {
  return `pong:user:${userId}`;
}

export async function publishPongEvent(channel: string, event: Omit<PongRealtimeEvent, "occurredAt">) {
  const value: PongRealtimeEvent = { ...event, occurredAt: new Date().toISOString() };
  const encoded = JSON.stringify(value);
  const client = await publisher();
  if (client) await client.publish(channel, encoded);
  else localBus().emit(channel, encoded);
}

export async function subscribePongEvents(channels: string[], onEvent: (encoded: string) => void) {
  if (!redisUrl) {
    const subscribed = new Set(channels);
    for (const channel of subscribed) localBus().on(channel, onEvent);
    return {
      subscribe: async (channel: string) => {
        if (subscribed.has(channel)) return;
        subscribed.add(channel);
        localBus().on(channel, onEvent);
      },
      close: async () => {
        for (const channel of subscribed) localBus().off(channel, onEvent);
      },
    };
  }
  const client = createClient({ url: redisUrl });
  client.on("error", (error) => console.error("Redis Pong subscriber:", error));
  await client.connect();
  const subscribed = new Set(channels);
  for (const channel of subscribed) await client.subscribe(channel, onEvent);
  return {
    subscribe: async (channel: string) => {
      if (subscribed.has(channel)) return;
      subscribed.add(channel);
      await client.subscribe(channel, onEvent);
    },
    close: async () => {
      if (client.isOpen) await client.quit();
    },
  };
}

export async function setPongInput(roomId: string, userId: string, direction: PongInput) {
  const client = await publisher();
  const value = JSON.stringify({ direction, at: Date.now() });
  if (client) {
    const key = `pong:inputs:${roomId}`;
    await client.hSet(key, userId, value);
    await client.expire(key, 60 * 10);
    return;
  }
  const room = localInputs().get(roomId) ?? new Map();
  room.set(userId, { direction, at: Date.now() });
  localInputs().set(roomId, room);
}

export async function getPongInputs(roomId: string, ownerId: string, guestId: string) {
  const client = await publisher();
  const now = Date.now();
  const read = (value: string | undefined | null): PongInput => {
    if (!value) return 0;
    try {
      const parsed = JSON.parse(value) as { direction?: number; at?: number };
      if (!parsed.at || now - parsed.at > 2_000) return 0;
      return parsed.direction === -1 || parsed.direction === 1 ? parsed.direction : 0;
    } catch {
      return 0;
    }
  };
  if (client) {
    const values = await client.hmGet(`pong:inputs:${roomId}`, [ownerId, guestId]);
    return { owner: read(values[0]), guest: read(values[1]) };
  }
  const values = localInputs().get(roomId);
  const localRead = (userId: string): PongInput => {
    const value = values?.get(userId);
    if (!value || now - value.at > 2_000) return 0;
    return value.direction;
  };
  return { owner: localRead(ownerId), guest: localRead(guestId) };
}

export async function savePongState(roomId: string, state: PongPhysicsState) {
  const client = await publisher();
  if (client) await client.set(`pong:state:${roomId}`, JSON.stringify(state), { EX: 60 * 10 });
  else localStates().set(roomId, state);
}

export async function loadPongState(roomId: string) {
  const client = await publisher();
  if (client) {
    const value = await client.get(`pong:state:${roomId}`);
    if (!value) return null;
    try { return JSON.parse(value) as PongPhysicsState; } catch { return null; }
  }
  return localStates().get(roomId) ?? null;
}

export async function acquirePongAuthority(roomId: string, token: string) {
  const client = await publisher();
  if (client) return (await client.set(`pong:authority:${roomId}`, token, { NX: true, PX: 4_000 })) === "OK";
  const current = localLocks().get(roomId);
  if (current && current.expiresAt > Date.now() && current.token !== token) return false;
  localLocks().set(roomId, { token, expiresAt: Date.now() + 4_000 });
  return true;
}

export async function renewPongAuthority(roomId: string, token: string) {
  const client = await publisher();
  if (client) {
    const result = await client.eval(
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('pexpire', KEYS[1], ARGV[2]) else return 0 end",
      { keys: [`pong:authority:${roomId}`], arguments: [token, "4000"] },
    );
    return Number(result) === 1;
  }
  const current = localLocks().get(roomId);
  if (!current || current.token !== token) return false;
  localLocks().set(roomId, { token, expiresAt: Date.now() + 4_000 });
  return true;
}

export async function releasePongAuthority(roomId: string, token: string) {
  const client = await publisher();
  if (client) {
    await client.eval(
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
      { keys: [`pong:authority:${roomId}`], arguments: [token] },
    );
    return;
  }
  if (localLocks().get(roomId)?.token === token) localLocks().delete(roomId);
}

function connectionKey(roomId: string, userId: string) {
  return `pong:connections:${roomId}:${userId}`;
}

export async function touchPongConnection(roomId: string, userId: string, connectionId: string) {
  const client = await publisher();
  const key = connectionKey(roomId, userId);
  const now = Date.now();
  if (client) {
    await client.zAdd(key, [{ score: now, value: connectionId }]);
    await client.zRemRangeByScore(key, 0, now - 45_000);
    await client.expire(key, 60 * 10);
    return;
  }
  const connections = localConnections().get(key) ?? new Map();
  connections.set(connectionId, now);
  for (const [id, seenAt] of connections) if (seenAt < now - 45_000) connections.delete(id);
  localConnections().set(key, connections);
}

export async function removePongConnection(roomId: string, userId: string, connectionId: string) {
  const client = await publisher();
  const key = connectionKey(roomId, userId);
  if (client) await client.zRem(key, connectionId);
  else localConnections().get(key)?.delete(connectionId);
  return pongConnectionCount(roomId, userId);
}

export async function pongConnectionCount(roomId: string, userId: string) {
  const client = await publisher();
  const key = connectionKey(roomId, userId);
  const now = Date.now();
  if (client) {
    await client.zRemRangeByScore(key, 0, now - 45_000);
    return client.zCard(key);
  }
  const connections = localConnections().get(key);
  if (!connections) return 0;
  for (const [id, seenAt] of connections) if (seenAt < now - 45_000) connections.delete(id);
  return connections.size;
}
