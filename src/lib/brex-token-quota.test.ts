import assert from "node:assert/strict";
import test from "node:test";
import { BREX_TOKEN_BALANCE_LIMIT, BREX_TOKEN_COOLDOWN_MS, currentBrexQuota, debitBrexQuota } from "./brex-token-quota";

test("Brex debits model input and output and preserves the remaining balance", () => {
  const now = new Date("2026-11-20T12:00:00.000Z");
  const quota = currentBrexQuota(null, now);
  const debit = debitBrexQuota(quota, 1_336 + 74, now);
  assert.equal(debit.chargedTokens, 1_410);
  assert.equal(debit.quota.remaining, 8_590);
  assert.equal(debit.quota.refreshAt, null);
});

test("the final answer exhausts the balance and starts the 30 minute cooldown", () => {
  const now = new Date("2026-11-20T12:00:00.000Z");
  const quota = currentBrexQuota({ usedTokens: 9_900, exhaustedAt: null }, now);
  const debit = debitBrexQuota(quota, 1_410, now);
  assert.equal(debit.chargedTokens, 100);
  assert.equal(debit.quota.remaining, 0);
  assert.equal(debit.quota.refreshAt, new Date(now.getTime() + BREX_TOKEN_COOLDOWN_MS).toISOString());
  assert.throws(() => debitBrexQuota(debit.quota, 1, now), /BREX_QUOTA_EXHAUSTED/);
  assert.equal(currentBrexQuota({ usedTokens: debit.usedTokens, exhaustedAt: now }, new Date(now.getTime() + BREX_TOKEN_COOLDOWN_MS - 1)).remaining, 0);
  assert.equal(currentBrexQuota({ usedTokens: debit.usedTokens, exhaustedAt: now }, new Date(now.getTime() + BREX_TOKEN_COOLDOWN_MS)).remaining, BREX_TOKEN_BALANCE_LIMIT);
});
