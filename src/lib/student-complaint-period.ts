import { SCHOOL_TIME_ZONE, schoolLocalToUtc } from "@/lib/activities";
import { getSchoolMonth, getSchoolWeek } from "@/lib/school-day";

export function complaintPeriod(now = new Date(), resetAt?: Date | null, timeZone = SCHOOL_TIME_ZONE) {
  const week = getSchoolWeek(now, timeZone);
  const month = getSchoolMonth(now, timeZone);
  const weekStart = new Date(schoolLocalToUtc(`${week.key}T00:00`, timeZone));
  const nextMonday = new Date(`${week.key}T00:00:00.000Z`);
  nextMonday.setUTCDate(nextMonday.getUTCDate() + 7);
  const nextWeekKey = nextMonday.toISOString().slice(0, 10);
  const weekEnd = new Date(schoolLocalToUtc(`${nextWeekKey}T00:00`, timeZone));
  const latest = (start: Date) => resetAt && resetAt > start ? resetAt : start;
  return { weekStart: latest(weekStart), weekEnd, monthStart: latest(month.start), monthEnd: month.end, weekKey: week.key, monthKey: month.key };
}

export function complaintWeekDays(weekKey: string, timeZone = SCHOOL_TIME_ZONE) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${weekKey}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    return { key, start: new Date(schoolLocalToUtc(`${key}T00:00`, timeZone)) };
  });
}
