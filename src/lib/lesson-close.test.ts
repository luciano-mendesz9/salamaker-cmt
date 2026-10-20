import assert from "node:assert/strict";
import test from "node:test";
import { buildLessonSettlements } from "./lesson-close";

test("combina presenças registradas e manuais no fechamento", () => {
  const settlements = buildLessonSettlements({
    participantIds: ["a", "b", "c", "d"],
    recordedPresentIds: ["a"],
    manualPresentIds: ["b"],
    excusedIds: ["c"],
  });

  assert.deepEqual(settlements.map(({ studentId, status, delta, manuallyMarkedPresent }) => ({ studentId, status, delta, manuallyMarkedPresent })), [
    { studentId: "a", status: "PRESENT", delta: 30, manuallyMarkedPresent: false },
    { studentId: "b", status: "PRESENT", delta: 30, manuallyMarkedPresent: true },
    { studentId: "c", status: "EXCUSED", delta: 10, manuallyMarkedPresent: false },
    { studentId: "d", status: "ABSENT", delta: -50, manuallyMarkedPresent: false },
  ]);
});

test("rejeita aluno externo e revisão contraditória", () => {
  assert.throws(() => buildLessonSettlements({ participantIds: ["a"], recordedPresentIds: [], manualPresentIds: ["b"], excusedIds: [] }), /INVALID_PARTICIPANT/);
  assert.throws(() => buildLessonSettlements({ participantIds: ["a"], recordedPresentIds: [], manualPresentIds: ["a"], excusedIds: ["a"] }), /CONFLICTING_ATTENDANCE_REVIEW/);
});
