"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

function remainingTime(targetAt: string, now: number) {
  const remaining = Math.max(0, new Date(targetAt).getTime() - now);
  const totalSeconds = Math.floor(remaining / 1000);
  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor(totalSeconds % 86_400 / 3_600),
    minutes: Math.floor(totalSeconds % 3_600 / 60),
    seconds: totalSeconds % 60,
  };
}

export function XpAdjustmentAlert({ startsAt, targetAt, observedAt }: { startsAt: string; targetAt: string; observedAt: string }) {
  const [now, setNow] = useState(() => new Date(observedAt).getTime());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  const remaining = useMemo(() => remainingTime(targetAt, now), [targetAt, now]);
  const units = [
    [remaining.days, "dias"],
    [remaining.hours, "horas"],
    [remaining.minutes, "min"],
    [remaining.seconds, "seg"],
  ] as const;

  if (now < new Date(startsAt).getTime() || now >= new Date(targetAt).getTime()) return null;

  return <section className="rounded-3xl border border-red-400/35 bg-gradient-to-br from-red-500/18 via-red-500/10 to-rose-950/20 p-5 shadow-[0_18px_60px_rgba(127,29,29,.18)] sm:p-6" aria-labelledby="xp-adjustment-title">
    <div className="flex items-start gap-4">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-red-300/25 bg-red-400/15 text-red-200"><TriangleAlert size={25} aria-hidden="true"/></span>
      <div className="min-w-0 flex-1">
        <p className="eyebrow text-red-200/75">Controle da inflação de XP</p>
        <h2 id="xp-adjustment-title" className="mt-1 font-display text-xl font-black text-red-50 sm:text-2xl">Ajuste de XP Geral</h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-red-50/75">Todos os saldos de XP serão divididos por 10 de forma equivalente, para que a posição no ranking não mude. Como o XP é inteiro, resultados fracionados serão arredondados para cima — por exemplo, 9,23 vira 10 — e saldos negativos passarão a 0. Por causa desses arredondamentos, pode haver uma pequena margem de alteração no ranking.</p>
        <div className="mt-5 flex flex-wrap gap-2" aria-label="Tempo restante para o ajuste">
          {units.map(([value, label]) => <span key={label} className="min-w-[70px] rounded-xl border border-red-300/20 bg-[#160e18]/55 px-3 py-2 text-center"><strong className="block font-display text-xl text-white tabular-nums">{String(value).padStart(2, "0")}</strong><span className="text-[12px] font-semibold uppercase tracking-wide text-red-100/60">{label}</span></span>)}
        </div>
        <p className="mt-3 text-xs font-semibold text-red-100/60">Reajuste em 1º de cada mês, às 06h (horário de Fortaleza).</p>
      </div>
    </div>
  </section>;
}
