export const STUDENT_COMPLAINT_FEES = [2, 5, 10] as const;

export function nextComplaintCost(targetKind: "STUDENT" | "TEACHER", previousCount: number) {
  if (!Number.isInteger(previousCount) || previousCount < 0) throw new Error("INVALID_COMPLAINT_COUNT");
  if (targetKind === "TEACHER") return previousCount === 0 ? { ordinal: 1, fee: 0 } : null;
  const fee = STUDENT_COMPLAINT_FEES[previousCount];
  return fee === undefined ? null : { ordinal: previousCount + 1, fee };
}
