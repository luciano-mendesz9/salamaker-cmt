"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { formatStudentLastSeen, isStudentOnline } from "@/lib/student-presence";

type PresenceContextValue = {
  lastSeenByStudent: Record<string, number | null>;
  now: number;
};

const PresenceContext = createContext<PresenceContextValue | null>(null);

export function RankingPresenceProvider({ children, initialLastSeen }: {
  children: React.ReactNode;
  initialLastSeen: Record<string, number | null>;
}) {
  const [lastSeenByStudent, setLastSeenByStudent] = useState(initialLastSeen);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setNow(Date.now()));
    const timer = window.setInterval(() => setNow(Date.now()), 10_000);
    const updatePresence = (event: Event) => {
      const detail = (event as CustomEvent<{ type?: string; userId?: string; occurredAt?: string }>).detail;
      if (detail?.type !== "presence" || !detail.userId) return;
      const occurredAt = detail.occurredAt ? Date.parse(detail.occurredAt) : Date.now();
      setLastSeenByStudent(current => ({ ...current, [detail.userId as string]: Number.isNaN(occurredAt) ? Date.now() : occurredAt }));
      setNow(Date.now());
    };
    window.addEventListener("ludo-realtime", updatePresence);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(timer);
      window.removeEventListener("ludo-realtime", updatePresence);
    };
  }, []);

  const value = useMemo(() => ({ lastSeenByStudent, now }), [lastSeenByStudent, now]);
  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
}

function useStudentPresence(studentId: string) {
  const context = useContext(PresenceContext);
  if (!context) throw new Error("Ranking presence components require RankingPresenceProvider.");
  const lastSeenAt = context.lastSeenByStudent[studentId] ?? null;
  return { ready: context.now > 0, online: isStudentOnline(lastSeenAt, context.now), lastSeenAt, now: context.now };
}

export function RankingPresenceDot({ studentId }: { studentId: string }) {
  const { online, ready } = useStudentPresence(studentId);
  if (!ready || !online) return null;
  return <span aria-label="Online agora" title="Online agora" className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500 shadow-sm"/>;
}

export function RankingPresenceText({ studentId }: { studentId: string }) {
  const { online, lastSeenAt, now, ready } = useStudentPresence(studentId);
  if (!ready) return null;
  if (lastSeenAt === null) return <span>nunca acessou</span>;
  return online
    ? <span className="font-semibold text-emerald-600">online agora</span>
    : <span>visto por último {formatStudentLastSeen(lastSeenAt, now)}</span>;
}
