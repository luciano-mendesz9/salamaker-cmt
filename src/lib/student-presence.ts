export const STUDENT_ONLINE_WINDOW_MS = 45_000;

export function isStudentOnline(lastSeenAt: number | null, now: number) {
  return lastSeenAt !== null && now - lastSeenAt >= 0 && now - lastSeenAt <= STUDENT_ONLINE_WINDOW_MS;
}

export function formatStudentLastSeen(lastSeenAt: number | null, now: number) {
  if (lastSeenAt === null) return "nunca";
  const elapsedSeconds = Math.max(0, Math.floor((now - lastSeenAt) / 1_000));
  if (elapsedSeconds < 60) return "há menos de um minuto";

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) return new Intl.RelativeTimeFormat("pt-BR", { numeric: "always" }).format(-elapsedMinutes, "minute");

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return new Intl.RelativeTimeFormat("pt-BR", { numeric: "always" }).format(-elapsedHours, "hour");

  const elapsedDays = Math.floor(elapsedHours / 24);
  return new Intl.RelativeTimeFormat("pt-BR", { numeric: "always" }).format(-elapsedDays, "day");
}
