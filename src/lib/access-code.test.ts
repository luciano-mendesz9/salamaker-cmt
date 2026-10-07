import assert from "node:assert/strict";
import test from "node:test";
import { isValidAccessCode } from "./access-code";

test("accepts numeric and test student access codes", () => {
  assert.equal(isValidAccessCode("AL2026001"), true);
  assert.equal(isValidAccessCode("alteste01"), true);
  assert.equal(isValidAccessCode("ALTESTE02"), true);
});

test("keeps teacher codes numeric and rejects malformed access codes", () => {
  assert.equal(isValidAccessCode("PROF20260001"), true);
  assert.equal(isValidAccessCode("PROFTESTE01"), false);
  assert.equal(isValidAccessCode("AL-TESTE01"), false);
  assert.equal(isValidAccessCode("AL123"), false);
});
