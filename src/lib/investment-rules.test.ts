import assert from "node:assert/strict";
import test from "node:test";
import {
  compoundAmount,
  cumulativeXpFee,
  isValidInvestmentAmount,
  investmentDates,
  investmentValueAt,
  maximumInvestmentPayout,
  requiredGuarantee,
  WEEK_MS,
  xpFeeForApplication,
} from "./investment-rules";

test("charges the same cumulative XP fee when applications are split", () => {
  const first = xpFeeForApplication(1_000, 0, 0, 250);
  const second = xpFeeForApplication(1_000, 250, first, 250);
  assert.equal(first, 13);
  assert.equal(second, 12);
  assert.equal(first + second, cumulativeXpFee(1_000, 500));
});

test("rounds the percentage XP fee up", () => {
  assert.equal(cumulativeXpFee(37, 1_000), 2);
  assert.equal(cumulativeXpFee(1, 1_000), 1);
  assert.equal(cumulativeXpFee(0, 1_000), 0);
  assert.equal(cumulativeXpFee(1_000, 500), 25);
});

test("allows a fractional Cofrinho Maker quota and keeps Maker titles fixed", () => {
  assert.equal(isValidInvestmentAmount("MAKER_SAVINGS", 1), true);
  assert.equal(isValidInvestmentAmount("MAKER_SAVINGS", 999), true);
  assert.equal(isValidInvestmentAmount("MAKER_SAVINGS", 1_000), true);
  assert.equal(isValidInvestmentAmount("MAKER_SAVINGS", 1_001), false);
  assert.equal(isValidInvestmentAmount("MAKER_BOND", 500), false);
  assert.equal(isValidInvestmentAmount("MAKER_BOND", 1_000), true);
  assert.equal(isValidInvestmentAmount("MAKER_BOND_PLUS", 2_000), true);
});

test("rejects more than three thousand Dev-Coins per school day", () => {
  assert.throws(() => xpFeeForApplication(1_000, 3_000, 150, 1_000), /DAILY_INVESTMENT_LIMIT/);
});

test("compounds weekly with integer settlement", () => {
  assert.equal(compoundAmount(1_000, 500, 1), 1_050);
  assert.equal(compoundAmount(1_000, 600, 2), 1_123);
  assert.equal(compoundAmount(1_000, 800, 4), 1_360);
  assert.equal(maximumInvestmentPayout(1_000, 800), 1_851);
});

test("accrues only complete weeks and stops after eight weeks", () => {
  const appliedAt = new Date("2026-10-01T12:00:00.000Z");
  const dates = investmentDates(appliedAt, 1);
  assert.equal(investmentValueAt({ principal: 1_000, weeklyRateBps: 500, appliedAt, yieldEndsAt: dates.yieldEndsAt }, new Date(appliedAt.getTime() + 13 * 24 * 60 * 60 * 1_000)).weeks, 1);
  assert.equal(investmentValueAt({ principal: 1_000, weeklyRateBps: 500, appliedAt, yieldEndsAt: dates.yieldEndsAt }, new Date(appliedAt.getTime() + 12 * WEEK_MS)).weeks, 8);
});

test("requires the configured reserve coverage", () => {
  assert.equal(requiredGuarantee(25_000, 12_000), 30_000);
});
