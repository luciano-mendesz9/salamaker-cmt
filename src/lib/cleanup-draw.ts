export type CleanupCandidate = {
  id: string;
  lastCleanupAt: Date | null;
};

export function cleanupCandidatePool(candidates: CleanupCandidate[], monthStart: Date, fifteenDaysAgo: Date) {
  const firstThisMonth = candidates.filter((candidate) => !candidate.lastCleanupAt || candidate.lastCleanupAt < monthStart);
  if (firstThisMonth.length) return { candidates: firstThisMonth, strategy: "FIRST_THIS_MONTH" as const };

  return {
    candidates: candidates.filter((candidate) => candidate.lastCleanupAt && candidate.lastCleanupAt <= fifteenDaysAgo),
    strategy: "FIFTEEN_DAY_INTERVAL" as const,
  };
}
