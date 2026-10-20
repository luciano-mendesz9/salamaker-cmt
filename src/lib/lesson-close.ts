export type LessonSettlement = {
  studentId: string;
  status: "PRESENT" | "EXCUSED" | "ABSENT";
  delta: number;
  reason: string;
  manuallyMarkedPresent: boolean;
};

export function buildLessonSettlements({
  participantIds,
  recordedPresentIds,
  manualPresentIds,
  excusedIds,
}: {
  participantIds: string[];
  recordedPresentIds: string[];
  manualPresentIds: string[];
  excusedIds: string[];
}): LessonSettlement[] {
  const participants = new Set(participantIds);
  const recordedPresent = new Set(recordedPresentIds);
  const manualPresent = new Set(manualPresentIds);
  const excused = new Set(excusedIds);

  if ([...manualPresent, ...excused].some((studentId) => !participants.has(studentId))) {
    throw new Error("INVALID_PARTICIPANT");
  }
  if ([...manualPresent].some((studentId) => excused.has(studentId))) {
    throw new Error("CONFLICTING_ATTENDANCE_REVIEW");
  }

  return participantIds.map((studentId) => {
    const manuallyMarkedPresent = manualPresent.has(studentId) && !recordedPresent.has(studentId);
    const status = recordedPresent.has(studentId) || manualPresent.has(studentId)
      ? "PRESENT" as const
      : excused.has(studentId)
        ? "EXCUSED" as const
        : "ABSENT" as const;
    const delta = status === "PRESENT" ? 30 : status === "EXCUSED" ? 10 : -50;
    const reason = status === "PRESENT" ? "Presença confirmada" : status === "EXCUSED" ? "Ausência justificada" : "Ausência sem justificativa";
    return { studentId, status, delta, reason, manuallyMarkedPresent };
  });
}
