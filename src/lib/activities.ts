export const SCHOOL_TIME_ZONE = "America/Fortaleza";

export type EffectiveActivityState = "SCHEDULED" | "OPEN" | "CLOSED";

export function isActiveRoboticsStudent(user: { role: string; status: string }) {
  return user.role === "STUDENT" && user.status === "ACTIVE";
}

export function effectiveActivityState(activity: {
  opensAt: Date;
  closesAt: Date;
  manuallyClosedAt: Date | null;
}, now = new Date()): EffectiveActivityState {
  if (activity.manuallyClosedAt || now >= activity.closesAt) return "CLOSED";
  if (now < activity.opensAt) return "SCHEDULED";
  return "OPEN";
}

export function assertOpenForSubmission(activity: {
  opensAt: Date;
  closesAt: Date;
  manuallyClosedAt: Date | null;
}, now = new Date()) {
  if (effectiveActivityState(activity, now) !== "OPEN") throw new Error("ACTIVITY_NOT_OPEN");
}

export function gradeObjectiveAnswer(
  selectedOptionIds: string[],
  options: { id: string; isCorrect: boolean }[],
  maxXp: number,
) {
  const selected = new Set(selectedOptionIds);
  const validIds = new Set(options.map((option) => option.id));
  if (selected.size !== selectedOptionIds.length || [...selected].some((id) => !validIds.has(id))) {
    throw new Error("INVALID_OPTIONS");
  }
  const correct = options.filter((option) => option.isCorrect).map((option) => option.id);
  const exact = selected.size === correct.length && correct.every((id) => selected.has(id));
  return { correct: exact, awardedXp: exact ? maxXp : 0 };
}

export function validateWrittenGrade(grade: "CORRECT" | "INCORRECT" | "PARTIAL", awardedXp: number, maxXp: number) {
  if (!Number.isInteger(awardedXp) || awardedXp < 0 || awardedXp > maxXp) throw new Error("INVALID_GRADE");
  if (grade === "CORRECT" && awardedXp !== maxXp) throw new Error("INVALID_GRADE");
  if (grade === "INCORRECT" && awardedXp !== 0) throw new Error("INVALID_GRADE");
  if (grade === "PARTIAL" && (awardedXp <= 0 || awardedXp >= maxXp)) throw new Error("INVALID_GRADE");
}

export function activityAwardDelta(previousXp: number | null, nextXp: number) {
  return nextXp - (previousXp ?? 0);
}

export function assertUniqueSubmission(existingSubmissionId: string | null) {
  if (existingSubmissionId) throw new Error("DUPLICATE_SUBMISSION");
}

export function assertRecipientOwner(recipientStudentId: string, requesterStudentId: string) {
  if (recipientStudentId !== requesterStudentId) throw new Error("RECIPIENT_FORBIDDEN");
}

export function balancedTeams<T>(students: T[], teamCount: number, random = Math.random): T[][] {
  if (!Number.isInteger(teamCount) || teamCount < 1 || teamCount > students.length) throw new Error("INVALID_TEAM_COUNT");
  const shuffled = [...students];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
  }
  const teams = Array.from({ length: teamCount }, () => [] as T[]);
  shuffled.forEach((student, index) => teams[index % teamCount].push(student));
  return teams;
}

export function formatSchoolDate(value: Date, timeZone = SCHOOL_TIME_ZONE) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone,
  }).format(value);
}

export function schoolLocalToUtc(value: string, timeZone = SCHOOL_TIME_ZONE) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("INVALID_LOCAL_DATE");
  const [, year, month, day, hour, minute] = match.map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  let guess = desired;
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(guess)).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
    const rendered = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    guess += desired - rendered;
  }
  return new Date(guess).toISOString();
}

export const activityStateLabel: Record<EffectiveActivityState, string> = {
  SCHEDULED: "Agendada",
  OPEN: "Aberta",
  CLOSED: "Fechada",
};
