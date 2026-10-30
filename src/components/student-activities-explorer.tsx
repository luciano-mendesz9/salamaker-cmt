"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2, Clock3, ExternalLink, Search, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";

type ActivityItem = { id: string; title: string; description: string | null; type: "EXTERNAL_LINK" | "FORM" | "GROUP" | "CPP_CODE"; maxXp: number; opensAt: string; closesAt: string; state: "SCHEDULED" | "OPEN" | "CLOSED"; completed: boolean; status: string };
type Filter = "ALL" | "OPEN" | "COMPLETED" | "CLOSED";
const typeLabels = { EXTERNAL_LINK: "Link externo", FORM: "Formulário", GROUP: "Em grupo", CPP_CODE: "Código C++" } as const;
const filters: { key: Filter; label: string }[] = [{ key: "ALL", label: "Todas" }, { key: "OPEN", label: "Em aberto" }, { key: "COMPLETED", label: "Concluídas" }, { key: "CLOSED", label: "Encerradas" }];

export function StudentActivitiesExplorer({ items, timeZone }: { items: ActivityItem[]; timeZone: string }) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");
  const visible = useMemo(() => items.filter(item => {
    const matchesText = `${item.title} ${item.description ?? ""} ${typeLabels[item.type]}`.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR"));
    const matchesFilter = filter === "ALL" || (filter === "COMPLETED" ? item.completed : filter === "OPEN" ? item.state === "OPEN" && !item.completed : item.state === "CLOSED" && !item.completed);
    return matchesText && matchesFilter;
  }), [filter, items, query]);
  const formatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone });

  return <>
    <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-800 bg-slate-950/35 p-1" role="group" aria-label="Filtrar atividades">{filters.map(item => <button key={item.key} type="button" onClick={() => setFilter(item.key)} aria-pressed={filter === item.key} className={`min-h-10 rounded-lg px-4 text-sm font-bold transition ${filter === item.key ? "bg-[var(--accent)] text-white shadow" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>{item.label}</button>)}</div>
      <label className="relative block w-full lg:w-72"><Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={17}/><span className="sr-only">Buscar atividade</span><input value={query} onChange={event => setQuery(event.target.value)} className="input !pl-10 text-sm" placeholder="Buscar atividade…"/></label>
    </div>
    {visible.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{visible.map(item => {
      const Icon = item.completed ? CheckCircle2 : item.type === "GROUP" ? UsersRound : item.type === "EXTERNAL_LINK" ? ExternalLink : BookOpen;
      const statusLabel = item.completed ? "Concluída" : item.state === "OPEN" ? "Em aberto" : item.state === "SCHEDULED" ? "Agendada" : "Encerrada";
      const statusStyle = item.completed ? "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent-soft)]" : item.state === "OPEN" ? "bg-emerald-400/10 text-emerald-300" : "bg-slate-700/40 text-slate-400";
      return <article key={item.id} className="student-card flex min-h-[300px] flex-col rounded-3xl p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><span className="grid h-12 w-12 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--accent)_11%,transparent)] text-[var(--accent-soft)]"><Icon size={22}/></span><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${statusStyle}`}>{statusLabel}</span></div><p className="eyebrow mt-6 text-slate-500">{typeLabels[item.type]}</p><h2 className="mt-2 text-lg font-bold leading-snug">{item.title}</h2><p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-400">{item.description || "Consulte os detalhes e orientações desta atividade."}</p><div className="mt-auto flex items-center justify-between gap-3 pt-6 text-xs"><span className="flex items-center gap-1.5 text-slate-500"><Clock3 size={14}/>{item.state === "SCHEDULED" ? "Abre" : item.state === "OPEN" ? "Até" : "Encerrou"} {formatter.format(new Date(item.state === "SCHEDULED" ? item.opensAt : item.closesAt))}</span><strong className="text-[var(--accent-soft)]">Até {item.maxXp} XP</strong></div><Link href={`/aluno/atividades/${item.id}`} className={item.state === "OPEN" && !item.completed ? "button-primary mt-5 w-full" : "button-secondary mt-5 w-full"}>{item.state === "OPEN" && !item.completed ? "Abrir atividade" : "Ver detalhes"}<ArrowRight className="ml-auto" size={16}/></Link></article>;
    })}</div> : <div className="student-card rounded-3xl p-10 text-center"><BookOpen className="mx-auto text-slate-600" size={32}/><h2 className="mt-4 font-display text-xl font-bold">Nenhuma atividade encontrada</h2><p className="mt-2 text-sm text-slate-500">Tente outra busca ou selecione um filtro diferente.</p></div>}
  </>;
}
