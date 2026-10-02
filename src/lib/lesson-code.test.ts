import assert from "node:assert/strict";
import test from "node:test";
import { hash } from "bcryptjs";
import { protectLessonCode, revealLessonCode, verifyLessonCode } from "./lesson-code";

const originalSecret = process.env.AUTH_SECRET;
process.env.AUTH_SECRET = "test-secret-with-at-least-thirty-two-characters";

test.after(() => {
  if (originalSecret === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = originalSecret;
});

test("protects and reveals a six-digit lesson code", () => {
  const protectedCode = protectLessonCode("123456");
  assert.notEqual(protectedCode, "123456");
  assert.equal(revealLessonCode(protectedCode), "123456");
});

test("rejects tampered protected lesson codes", () => {
  const protectedCode = protectLessonCode("123456");
  const parts = protectedCode.split(":");
  const tag = Buffer.from(parts[4], "base64url");
  tag[0] ^= 1;
  parts[4] = tag.toString("base64url");
  assert.equal(revealLessonCode(parts.join(":")), null);
});

test("verifies new protected codes and legacy bcrypt hashes", async () => {
  const protectedCode = protectLessonCode("654321");
  assert.equal(await verifyLessonCode("654321", protectedCode), true);
  assert.equal(await verifyLessonCode("000000", protectedCode), false);

  const legacyHash = await hash("112233", 4);
  assert.equal(await verifyLessonCode("112233", legacyHash), true);
  assert.equal(await verifyLessonCode("332211", legacyHash), false);
});
