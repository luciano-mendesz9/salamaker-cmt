import assert from "node:assert/strict";
import test from "node:test";
import { formatStudentLastSeen, isStudentOnline, STUDENT_ONLINE_WINDOW_MS } from "./student-presence";

test("student presence uses the heartbeat window", () => {
  const now = Date.UTC(2026, 9, 26, 12);
  assert.equal(isStudentOnline(now - STUDENT_ONLINE_WINDOW_MS, now), true);
  assert.equal(isStudentOnline(now - STUDENT_ONLINE_WINDOW_MS - 1, now), false);
  assert.equal(isStudentOnline(null, now), false);
});

test("student last seen is presented in friendly relative time", () => {
  const now = Date.UTC(2026, 9, 26, 12);
  assert.equal(formatStudentLastSeen(null, now), "nunca");
  assert.equal(formatStudentLastSeen(now - 30_000, now), "há menos de um minuto");
  assert.equal(formatStudentLastSeen(now - 2 * 60_000, now), "há 2 minutos");
  assert.equal(formatStudentLastSeen(now - 24 * 60 * 60_000, now), "há 1 dia");
});
