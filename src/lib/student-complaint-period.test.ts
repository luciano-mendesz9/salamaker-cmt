import assert from "node:assert/strict";
import test from "node:test";
import { complaintPeriod, complaintWeekDays } from "@/lib/student-complaint-period";

test("a semana escolar respeita Fortaleza e o reajuste corta as contagens sem apagar o histórico", () => {
  const now = new Date("2026-11-10T15:00:00.000Z");
  const resetAt = new Date("2026-11-10T09:00:00.000Z");
  const period = complaintPeriod(now, resetAt);
  assert.equal(period.weekKey, "2026-11-09");
  assert.equal(period.weekStart.toISOString(), resetAt.toISOString());
  assert.equal(period.weekEnd.toISOString(), "2026-11-16T03:00:00.000Z");
  assert.equal(period.monthStart.toISOString(), resetAt.toISOString());
  assert.equal(complaintWeekDays(period.weekKey)[0].start.toISOString(), "2026-11-09T03:00:00.000Z");
});
