import assert from "node:assert/strict";
import test from "node:test";
import { generateXpGrantCode, normalizeStudentAccessCode, xpGrantIdempotencyKey, XP_GRANT_CODE_PATTERN } from "./xp-grant-codes";

test("generates a six-digit numeric XP grant code", () => {
  for (let index = 0; index < 100; index += 1) assert.match(generateXpGrantCode(), XP_GRANT_CODE_PATTERN);
});

test("normalizes the student access code", () => {
  assert.equal(normalizeStudentAccessCode("  al2026001 "), "AL2026001");
});

test("builds a stable idempotency key per grant code and student", () => {
  assert.equal(xpGrantIdempotencyKey("grant-id", "student-id"), "xp-grant-code:grant-id:student-id");
});
