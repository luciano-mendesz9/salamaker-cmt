"use client";

import { useEffect, useState } from "react";
import { Activity, ArrowRight, Star, X } from "lucide-react";

type Rating = { id: string; score: number; reason: string | null; createdAt: Date; lesson: { title: string } };

export function BehaviorChart({ ratings }: { ratings: Rating[] }) {
  const [open, setOpen] = useState(false);
  const average = ratings.length ? ratings.reduce((sum, rating) => sum + rating.score, 0) / ratings.length : 0;

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", close);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", close); };
  }, [open]);

  return <>
    <button type="button" onClick={() => setOpen(true)} className="student-card focus-ring group w-full rounded-3xl p-5 text-left transition hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--accent)_42%,var(--line))] sm:p-6">
      <div className="flex items-start justify-between gap-4"><div><span className="grid h-11 w-11 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent-soft)]"><Activity size={21}/></span><h2 className="mt-4 font-display text-xl font-bold">Meu comportamento</h2><p className="mt-2 text-sm leading-relaxed text-slate-400">{ratings.length ? "Veja sua evolução nas aulas avaliadas." : "Suas avaliações aparecerão aqui."}</p></div><div className="text-right"><strong className="font-display text-4xl font-black text-[var(--accent-soft)]">{ratings.length ? average.toFixed(1) : "—"}</strong><p className="mt-1 text-xs text-slate-500">média de 5</p></div></div>
      <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[var(--accent-soft)]">Ver detalhes<ArrowRight className="transition group-hover:translate-x-1" size={16}/></span>
    </button>
    {open && <div className="student-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="behavior-dialog-title" className="student-dialog max-w-2xl p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4"><div><p className="eyebrow">Minha jornada</p><h2 id="behavior-dialog-title" className="mt-2 font-display text-2xl font-bold">Comportamento em aula</h2></div><button autoFocus type="button" onClick={() => setOpen(false)} className="student-icon-button shrink-0" aria-label="Fechar comportamento"><X size={19}/></button></div>
        {ratings.length ? <><div className="mt-6 flex items-center justify-between rounded-2xl border border-amber-300/20 bg-amber-300/8 p-5"><div><p className="text-sm text-amber-100/75">Média das aulas avaliadas</p><strong className="mt-1 block font-display text-4xl font-black text-amber-200">{average.toFixed(1)} <small className="text-sm font-semibold text-amber-100/60">/ 5</small></strong></div><Star className="text-amber-300" size={38}/></div>
          <h3 className="mt-7 text-base font-bold">Evolução das avaliações</h3><div className="mt-4 flex h-48 items-end gap-3 border-b border-slate-700 px-2">{ratings.slice().reverse().map(rating => <div key={rating.id} className="flex h-full min-w-0 flex-1 flex-col justify-end text-center" title={`${rating.lesson.title}: ${rating.score}/5`}><span className="mb-2 text-xs font-bold">{rating.score}</span><div className={`mx-auto w-full max-w-12 rounded-t-lg ${rating.score >= 4 ? "bg-emerald-400" : rating.score === 3 ? "bg-amber-400" : "bg-rose-400"}`} style={{ height: `${rating.score * 20}%` }}/><span className="mt-2 truncate text-xs text-slate-500">{rating.lesson.title}</span></div>)}</div>
          <div className="mt-6 divide-y divide-slate-800">{ratings.slice(0, 4).map(rating => <div key={rating.id} className="flex justify-between gap-4 py-4 text-sm"><span className="leading-relaxed text-slate-400"><strong className="text-slate-200">{rating.lesson.title}</strong>{rating.reason ? ` · ${rating.reason}` : ""}</span><strong className="whitespace-nowrap">{rating.score}/5</strong></div>)}</div></> : <div className="mt-7 rounded-2xl border border-dashed border-slate-700 p-8 text-center"><Activity className="mx-auto text-slate-600"/><p className="mt-4 text-sm text-slate-400">Você ainda não recebeu avaliações de comportamento.</p></div>}
      </section>
    </div>}
  </>;
}
