import { SCHOOL_TIME_ZONE, schoolLocalToUtc } from "@/lib/activities";

export const XP_ADJUSTMENT_DIVISOR = 10;
export const XP_ADJUSTMENT_DAY = 1;
export const XP_ADJUSTMENT_HOUR = 6;
export const XP_ALERT_START_DAY = 25;

type LocalDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
};

function schoolDateParts(now: Date): LocalDateParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: SCHOOL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(now)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return { year: parts.year, month: parts.month, day: parts.day, hour: parts.hour };
}

function periodKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function followingMonth(year: number, month: number) {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

function previousMonth(year: number, month: number) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

export function adjustedXp(currentXp: number) {
  if (!Number.isInteger(currentXp)) throw new Error("INVALID_XP");
  return Math.max(0, Math.ceil(currentXp / XP_ADJUSTMENT_DIVISOR));
}

export function getXpAdjustmentSchedule(now = new Date()) {
  const local = schoolDateParts(now);
  let target = followingMonth(local.year, local.month);

  if (local.day === XP_ADJUSTMENT_DAY && local.hour < XP_ADJUSTMENT_HOUR) {
    target = { year: local.year, month: local.month };
  }

  const key = periodKey(target.year, target.month);
  const start = previousMonth(target.year, target.month);
  return {
    periodKey: key,
    startsAt: new Date(schoolLocalToUtc(`${periodKey(start.year, start.month)}-${XP_ALERT_START_DAY}T00:00`, SCHOOL_TIME_ZONE)),
    targetAt: new Date(schoolLocalToUtc(`${key}-01T06:00`, SCHOOL_TIME_ZONE)),
  };
}

export function getXpAdjustmentAlert(now = new Date()) {
  const schedule = getXpAdjustmentSchedule(now);
  return now >= schedule.startsAt && now < schedule.targetAt ? schedule : null;
}

export function getDueXpAdjustmentPeriod(now = new Date()) {
  const local = schoolDateParts(now);
  if (local.day !== XP_ADJUSTMENT_DAY || local.hour < XP_ADJUSTMENT_HOUR) return null;
  return periodKey(local.year, local.month);
}
