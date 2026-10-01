import { EventEmitter } from "node:events";
import { createClient, type RedisClientType } from "redis";

export type LudoRealtimeEvent = {
  type: "presence" | "room" | "invitation" | "chat";
  roomId?: string;
  userId?: string;
  payload?: unknown;
  occurredAt: string;
};

const redisUrl = process.env.REDIS_URL ?? process.env.KV_URL;
const globalRealtime = globalThis as unknown as {
  ludoPublisher?: RedisClientType;
  ludoLocalBus?: EventEmitter;
};

function localBus() {
  globalRealtime.ludoLocalBus ??= new EventEmitter().setMaxListeners(200);
  return globalRealtime.ludoLocalBus;
}

async function publisher() {
  if (!redisUrl) return null;
  if (!globalRealtime.ludoPublisher) {
    const client = createClient({ url: redisUrl });
    client.on("error", error => console.error("Redis Ludo publisher:", error));
    globalRealtime.ludoPublisher = client as RedisClientType;
  }
  const client = globalRealtime.ludoPublisher;
  if (!client.isOpen) await client.connect();
  return client;
}

export function ludoRealtimeConfigured() {
  return Boolean(redisUrl);
}

export function roomChannel(roomId: string) {
  return `ludo:room:${roomId}`;
}

export function userChannel(userId: string) {
  return `ludo:user:${userId}`;
}

export async function publishLudoEvent(channel: string, event: Omit<LudoRealtimeEvent, "occurredAt">) {
  const value: LudoRealtimeEvent = { ...event, occurredAt: new Date().toISOString() };
  const encoded = JSON.stringify(value);
  const client = await publisher();
  if (client) await client.publish(channel, encoded);
  else localBus().emit(channel, encoded);
}

export async function markLudoPresence(userId: string) {
  const now = Date.now();
  const client = await publisher();
  if (client) {
    await client.zAdd("ludo:presence", [{ score: now, value: userId }]);
    await client.zRemRangeByScore("ludo:presence", 0, now - 45_000);
  }
  await publishLudoEvent("ludo:presence-events", { type: "presence", userId });
}

export async function removeLudoPresence(userId: string) {
  const client = await publisher();
  if (client) await client.zRem("ludo:presence", userId);
  await publishLudoEvent("ludo:presence-events", { type: "presence", userId });
}

export async function onlineLudoStudentIds() {
  const client = await publisher();
  if (!client) return [];
  const now = Date.now();
  await client.zRemRangeByScore("ludo:presence", 0, now - 45_000);
  return client.zRangeByScore("ludo:presence", now - 45_000, "+inf");
}

export async function subscribeLudoEvents(channels: string[], onEvent: (encoded: string) => void) {
  if (!redisUrl) {
    for (const channel of channels) localBus().on(channel, onEvent);
    return {
      subscribe: async (channel: string) => localBus().on(channel, onEvent),
      close: async () => {
        for (const channel of channels) localBus().off(channel, onEvent);
      },
    };
  }
  const client = createClient({ url: redisUrl });
  client.on("error", error => console.error("Redis Ludo subscriber:", error));
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
