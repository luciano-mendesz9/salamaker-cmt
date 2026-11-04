import assert from "node:assert/strict";
import test from "node:test";
import { DEV_COIN_TO_XP_WINDOW_MS, devCoinToXpQuota, devCoinsRequiredForXp } from "./dev-coin-to-xp-policy";

test("reverse conversion stays ten times more expensive than the current XP purchase rate", () => {
  assert.equal(devCoinsRequiredForXp(1, 1), 10);
  assert.equal(devCoinsRequiredForXp(20, 3), 600);
  assert.throws(() => devCoinsRequiredForXp(21, 1));
});

test("rolling 48 hour quota releases each conversion when it expires", () => {
  const now = new Date("2026-11-03T12:00:00.000Z");
  const first = new Date(now.getTime() - DEV_COIN_TO_XP_WINDOW_MS + 1_000);
  const second = new Date(now.getTime() - 60_000);
  assert.deepEqual(devCoinToXpQuota([{ delta: 12, createdAt: first }, { delta: 8, createdAt: second }], now), {
    used: 20, remaining: 0, nextAvailableAt: new Date(now.getTime() + 1_000).toISOString(),
  });
  const later = new Date(now.getTime() + 1_000);
  assert.deepEqual(devCoinToXpQuota([{ delta: 12, createdAt: first }, { delta: 8, createdAt: second }], later), {
    used: 8, remaining: 12, nextAvailableAt: new Date(second.getTime() + DEV_COIN_TO_XP_WINDOW_MS).toISOString(),
  });
});
