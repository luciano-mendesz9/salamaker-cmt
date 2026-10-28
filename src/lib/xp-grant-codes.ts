import { randomInt } from "node:crypto";

export const XP_GRANT_CODE_PATTERN = /^\d{6}$/;
export const MAX_EXTERNAL_XP_GRANT = 100_000;

export function generateXpGrantCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function normalizeStudentAccessCode(value: string) {
  return value.trim().toUpperCase();
}

export function xpGrantIdempotencyKey(grantCodeId: string, studentId: string) {
  return `xp-grant-code:${grantCodeId}:${studentId}`;
}
