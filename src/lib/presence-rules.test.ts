import assert from "node:assert/strict";
import test from "node:test";
import { presenceParticipantDecision } from "./presence-rules";

const openedAt = new Date("2026-10-06T17:37:30.628Z");

test("keeps an existing lesson participant eligible", () => {
  assert.equal(presenceParticipantDecision({
    isParticipant: true,
    studentCreatedAt: new Date("2026-01-01T00:00:00.000Z"),
    lessonOpenedAt: openedAt,
  }), "EXISTING");
});

test("allows an active student created after the lesson opened to join on valid check-in", () => {
  assert.equal(presenceParticipantDecision({
    isParticipant: false,
    studentCreatedAt: new Date("2026-10-06T17:46:12.336Z"),
    lessonOpenedAt: openedAt,
  }), "ATTACH_LATE");
});

test("does not silently add an older student excluded from the lesson snapshot", () => {
  assert.equal(presenceParticipantDecision({
    isParticipant: false,
    studentCreatedAt: new Date("2026-10-06T16:00:00.000Z"),
    lessonOpenedAt: openedAt,
  }), "REJECT");
});
