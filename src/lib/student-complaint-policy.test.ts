import assert from "node:assert/strict";
import test from "node:test";
import { nextComplaintCost } from "@/lib/student-complaint-policy";

test("a mesma pessoa custa 2, 5 e 10 DC na aula e para após três registros", () => {
  assert.deepEqual(nextComplaintCost("STUDENT", 0), { ordinal: 1, fee: 2 });
  assert.deepEqual(nextComplaintCost("STUDENT", 1), { ordinal: 2, fee: 5 });
  assert.deepEqual(nextComplaintCost("STUDENT", 2), { ordinal: 3, fee: 10 });
  assert.equal(nextComplaintCost("STUDENT", 3), null);
});

test("reclamação do professor é gratuita e única por aluno e aula", () => {
  assert.deepEqual(nextComplaintCost("TEACHER", 0), { ordinal: 1, fee: 0 });
  assert.equal(nextComplaintCost("TEACHER", 1), null);
});
