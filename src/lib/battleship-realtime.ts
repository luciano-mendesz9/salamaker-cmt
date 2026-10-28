import { EventEmitter } from "node:events";
import { createClient, type RedisClientType } from "redis";

const redisUrl = process.env.REDIS_URL ?? process.env.KV_URL;
const state = globalThis as unknown as { battleshipPublisher?: RedisClientType; battleshipBus?: EventEmitter };

function bus() { state.battleshipBus ??= new EventEmitter().setMaxListeners(300); return state.battleshipBus; }
async function publisher() {
  if (!redisUrl) return null;
  if (!state.battleshipPublisher) { const client = createClient({ url: redisUrl }); client.on("error", (error) => console.error("Redis batalha naval:", error)); state.battleshipPublisher = client as RedisClientType; }
  if (!state.battleshipPublisher.isOpen) await state.battleshipPublisher.connect();
  return state.battleshipPublisher;
}
function channel(roomId: string) { return `battleship:room:${roomId}`; }
export async function publishBattleship(roomId: string, action: string) {
  const encoded = JSON.stringify({ type: "room", roomId, action, occurredAt: new Date().toISOString() });
  const client = await publisher(); if (client) await client.publish(channel(roomId), encoded); else bus().emit(channel(roomId), encoded);
}
export async function subscribeBattleship(roomId: string, onEvent: (encoded: string) => void) {
  const name = channel(roomId);
  if (!redisUrl) { bus().on(name, onEvent); return async () => bus().off(name, onEvent); }
  const client = createClient({ url: redisUrl }); client.on("error", (error) => console.error("Redis batalha naval subscriber:", error)); await client.connect(); await client.subscribe(name, onEvent);
  return async () => { if (client.isOpen) await client.quit(); };
}
