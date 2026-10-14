import assert from "node:assert/strict";
import test from "node:test";
import { studentBulkActionSchema } from "./student-bulk-actions";

const baseAction = {
  ids: ["00000000-0000-4000-8000-000000000001"],
  reason: "Ajuste manual",
  adminPassword: "secret",
};

test("bulk XP accepts positive and negative integer adjustments", () => {
  assert.equal(studentBulkActionSchema.safeParse({ ...baseAction, action: "XP", amount: 50 }).success, true);
  assert.equal(studentBulkActionSchema.safeParse({ ...baseAction, action: "XP", amount: -50 }).success, true);
});

test("bulk XP rejects zero and out-of-range adjustments", () => {
  assert.equal(studentBulkActionSchema.safeParse({ ...baseAction, action: "XP", amount: 0 }).success, false);
  assert.equal(studentBulkActionSchema.safeParse({ ...baseAction, action: "XP", amount: -10_001 }).success, false);
});

test("bulk Dev-Coins continues to reject negative amounts", () => {
  assert.equal(studentBulkActionSchema.safeParse({ ...baseAction, action: "DEV_COINS", amount: -50 }).success, false);
});
