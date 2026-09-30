import assert from "node:assert/strict";
import test from "node:test";
import { cleanupCandidatePool } from "./cleanup-draw";

const monthStart = new Date("2026-09-01T03:00:00.000Z");
const fifteenDaysAgo = new Date("2026-09-15T15:00:00.000Z");

test("prioriza alunos que ainda não fizeram faxina no mês", () => {
  const result = cleanupCandidatePool([
    { id: "never", lastCleanupAt: null },
    { id: "previous-month", lastCleanupAt: new Date("2026-08-31T20:00:00.000Z") },
    { id: "this-month", lastCleanupAt: new Date("2026-09-10T12:00:00.000Z") },
  ], monthStart, fifteenDaysAgo);
  assert.equal(result.strategy, "FIRST_THIS_MONTH");
  assert.deepEqual(result.candidates.map((candidate) => candidate.id), ["never", "previous-month"]);
});

test("aplica intervalo de quinze dias depois que todos participaram no mês", () => {
  const result = cleanupCandidatePool([
    { id: "eligible", lastCleanupAt: new Date("2026-09-15T15:00:00.000Z") },
    { id: "too-recent", lastCleanupAt: new Date("2026-09-20T12:00:00.000Z") },
  ], monthStart, fifteenDaysAgo);
  assert.equal(result.strategy, "FIFTEEN_DAY_INTERVAL");
  assert.deepEqual(result.candidates.map((candidate) => candidate.id), ["eligible"]);
});
