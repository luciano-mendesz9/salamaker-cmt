import assert from "node:assert/strict";
import test from "node:test";
import { activityAwardDelta, assertRecipientOwner, assertUniqueSubmission, balancedTeams, effectiveActivityState, gradeObjectiveAnswer, isActiveRoboticsStudent, schoolLocalToUtc, validateWrittenGrade } from "./activities";

test("estado efetivo respeita prazo e fechamento explícito", () => {
  const opensAt = new Date("2026-09-23T12:00:00Z");
  const closesAt = new Date("2026-09-23T14:00:00Z");
  assert.equal(effectiveActivityState({ opensAt, closesAt, manuallyClosedAt: null }, new Date("2026-09-23T11:00:00Z")), "SCHEDULED");
  assert.equal(effectiveActivityState({ opensAt, closesAt, manuallyClosedAt: null }, new Date("2026-09-23T13:00:00Z")), "OPEN");
  assert.equal(effectiveActivityState({ opensAt, closesAt, manuallyClosedAt: null }, closesAt), "CLOSED");
  assert.equal(effectiveActivityState({ opensAt, closesAt, manuallyClosedAt: opensAt }, opensAt), "CLOSED");
});

test("correção objetiva exige conjunto exato", () => {
  const options = [{ id: "a", isCorrect: true }, { id: "b", isCorrect: true }, { id: "c", isCorrect: false }];
  assert.deepEqual(gradeObjectiveAnswer(["b", "a"], options, 20), { correct: true, awardedXp: 20 });
  assert.deepEqual(gradeObjectiveAnswer(["a"], options, 20), { correct: false, awardedXp: 0 });
  assert.deepEqual(gradeObjectiveAnswer(["a", "b", "c"], options, 20), { correct: false, awardedXp: 0 });
});

test("correção escrita valida integral, zero e parcial", () => {
  assert.doesNotThrow(() => validateWrittenGrade("CORRECT", 10, 10));
  assert.doesNotThrow(() => validateWrittenGrade("INCORRECT", 0, 10));
  assert.doesNotThrow(() => validateWrittenGrade("PARTIAL", 4, 10));
  assert.throws(() => validateWrittenGrade("CORRECT", 9, 10));
  assert.throws(() => validateWrittenGrade("PARTIAL", 10, 10));
});

test("equipes aleatórias ficam equilibradas e sem duplicação", () => {
  const teams = balancedTeams([1, 2, 3, 4, 5, 6, 7], 3, () => 0.5);
  assert.equal(Math.max(...teams.map((team) => team.length)) - Math.min(...teams.map((team) => team.length)), 1);
  assert.deepEqual([...teams.flat()].sort(), [1, 2, 3, 4, 5, 6, 7]);
});

test("isolamento impede que outro aluno use o destinatário", () => {
  assert.doesNotThrow(() => assertRecipientOwner("aluno-a", "aluno-a"));
  assert.throws(() => assertRecipientOwner("aluno-a", "aluno-b"), /RECIPIENT_FORBIDDEN/);
});

test("envio duplicado é rejeitado", () => {
  assert.doesNotThrow(() => assertUniqueSubmission(null));
  assert.throws(() => assertUniqueSubmission("envio-existente"), /DUPLICATE_SUBMISSION/);
});

test("revisão de nota aplica apenas o delta", () => {
  assert.equal(activityAwardDelta(null, 30), 30);
  assert.equal(activityAwardDelta(30, 45), 15);
  assert.equal(activityAwardDelta(45, 20), -25);
  assert.equal(activityAwardDelta(20, 20), 0);
});

test("XP de equipe é individual, estável e sem duplicar na repetição", () => {
  const priorByStudent = new Map<string, number | null>([["a", null], ["b", null], ["c", null]]);
  const first = [...priorByStudent].map(([studentId, prior]) => [studentId, activityAwardDelta(prior, 25)] as const);
  assert.deepEqual(first, [["a",25],["b",25],["c",25]]);
  const repeated = first.map(([studentId]) => [studentId, activityAwardDelta(25, 25)] as const);
  assert.deepEqual(repeated, [["a",0],["b",0],["c",0]]);
});

test("horário local da escola é armazenado como instante UTC", () => {
  assert.equal(schoolLocalToUtc("2026-09-23T09:30", "America/Fortaleza"), "2026-09-23T12:30:00.000Z");
});

test("a coorte da Robótica inclui alunos ativos de qualquer turma regular", () => {
  const users = [
    { id: "6a", role: "STUDENT", status: "ACTIVE", originSchoolClass: "GRADE_6_A" },
    { id: "7c", role: "STUDENT", status: "ACTIVE", originSchoolClass: "GRADE_7_C" },
    { id: "inativo", role: "STUDENT", status: "INACTIVE", originSchoolClass: "GRADE_6_B" },
    { id: "professor", role: "TEACHER", status: "ACTIVE", originSchoolClass: null },
  ];
  assert.deepEqual(users.filter(isActiveRoboticsStudent).map((user) => user.id), ["6a", "7c"]);
});
