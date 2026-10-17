import { EventEmitter } from "node:events";
import { createClient, type RedisClientType } from "redis";

const redisUrl = process.env.REDIS_URL ?? process.env.KV_URL;
const state = globalThis as unknown as { ticTacToePublisher?: RedisClientType; ticTacToeBus?: EventEmitter };

function bus() {
  state.ticTacToeBus ??= new EventEmitter().setMaxListeners(300);
  return state.ticTacToeBus;
}

async function publisher() {
  if (!redisUrl) return null;
  if (!state.ticTacToePublisher) {
    const client = createClient({ url: redisUrl });
    client.on("error", (error) => console.error("Redis jogo da velha:", error));
    state.ticTacToePublisher = client as RedisClientType;
  }
  if (!state.ticTacToePublisher.isOpen) await state.ticTacToePublisher.connect();
  return state.ticTacToePublisher;
}

export function ticTacToeChannel(roomId: string) {
  return `tic-tac-toe:room:${roomId}`;
}

export async function publishTicTacToe(roomId: string, action: string) {
  const encoded = JSON.stringify({ type: "room", roomId, action, occurredAt: new Date().toISOString() });
  const client = await publisher();
  if (client) await client.publish(ticTacToeChannel(roomId), encoded);
  else bus().emit(ticTacToeChannel(roomId), encoded);
}

export async function subscribeTicTacToe(roomId: string, onEvent: (encoded: string) => void) {
  const channel = ticTacToeChannel(roomId);
  if (!redisUrl) {
    bus().on(channel, onEvent);
    return async () => bus().off(channel, onEvent);
  }
  const client = createClient({ url: redisUrl });
  client.on("error", (error) => console.error("Redis jogo da velha subscriber:", error));
  await client.connect();
  await client.subscribe(channel, onEvent);
  return async () => { if (client.isOpen) await client.quit(); };
}
