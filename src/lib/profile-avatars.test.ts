import assert from "node:assert/strict";
import test from "node:test";
import { devCoinsForXp, DEFAULT_DEV_COINS_PER_XP, INITIAL_DEV_COIN_GRANT } from "./dev-coins";
import { PROFILE_AVATAR_DEV_COIN_PRICE } from "./profile-avatar-pricing";

test("every paid avatar costs 20 Dev-Coins", () => {
  assert.equal(PROFILE_AVATAR_DEV_COIN_PRICE, 20);
});

test("Dev-Coin defaults and purchase cost are stable", () => {
  assert.equal(DEFAULT_DEV_COINS_PER_XP, 1);
  assert.equal(INITIAL_DEV_COIN_GRANT, 25);
  assert.equal(devCoinsForXp(1, 3), 3);
  assert.equal(devCoinsForXp(7, 3), 21);
  assert.throws(() => devCoinsForXp(0, 1), /INVALID_XP_AMOUNT/);
  assert.throws(() => devCoinsForXp(1, 0), /INVALID_DEV_COIN_RATE/);
});
