"use client";

import { Check, Coins, LockKeyhole, Palette, ShoppingCart, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getStudentTheme, STUDENT_THEMES, STUDENT_THEME_PRICE, STUDENT_THEME_STORAGE_KEY, type StudentThemeKey } from "@/lib/student-themes";

type Props = {
  studentId: string;
  activeTheme: StudentThemeKey;
  ownedThemes: StudentThemeKey[];
  currentDevCoins: number;
  storeReady: boolean;
};

export function StudentThemeStore({ studentId, activeTheme, ownedThemes, currentDevCoins, storeReady }: Props) {
  const router = useRouter();
  const [candidate, setCandidate] = useState<StudentThemeKey | null>(null);
  const [busy, setBusy] = useState(false);
  const selected = candidate ? getStudentTheme(candidate) : null;
  const candidateOwned = candidate ? ownedThemes.includes(candidate) : false;

  useEffect(() => {
    if (!candidate) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) setCandidate(null); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [candidate, busy]);

  async function applyTheme() {
    if (!candidate || busy || candidate === activeTheme) return;
    setBusy(true);
    try {
      const response = await fetch("/api/student/themes", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ theme: candidate }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message ?? "Não foi possível aplicar o tema.");
      document.querySelector<HTMLElement>("[data-student-theme]")?.setAttribute("data-student-theme", data.activeTheme);
      try { localStorage.setItem(STUDENT_THEME_STORAGE_KEY, JSON.stringify({ studentId, theme: data.activeTheme })); } catch {}
      toast.success(data.purchasedNow ? `Tema comprado por ${STUDENT_THEME_PRICE} Dev-Coins e aplicado.` : "Tema aplicado à sua interface.");
      setCandidate(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível aplicar o tema.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <section className="student-theme-store rounded-2xl border p-4" aria-labelledby="student-theme-store-title">
      <div className="flex items-start gap-3">
        <span className="student-theme-store-icon grid h-11 w-11 shrink-0 place-items-center rounded-xl"><Palette size={21}/></span>
        <div className="min-w-0 flex-1"><p className="eyebrow">Personalize seu espaço</p><h2 id="student-theme-store-title" className="mt-1 font-display text-lg font-bold">Temas da interface</h2><p className="mt-1 text-xs leading-relaxed text-slate-400">Compre uma vez e use em todos os seus dispositivos.</p></div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {STUDENT_THEMES.map((theme) => {
          const owned = ownedThemes.includes(theme.key);
          const active = activeTheme === theme.key;
          return <button key={theme.key} type="button" disabled={!storeReady && theme.key !== activeTheme} onClick={() => setCandidate(theme.key)} className={`student-theme-option focus-ring relative rounded-xl border p-2 text-left transition hover:-translate-y-0.5 ${active ? "is-active" : ""}`} aria-label={`${theme.name}${active ? ", em uso" : owned ? ", comprado" : `, ${theme.price} Dev-Coins`}`}>
            <span className="flex h-7 overflow-hidden rounded-lg" aria-hidden="true">{theme.colors.map((color) => <span key={color} className="flex-1" style={{ background: color }}/>)}</span>
            <strong className="mt-2 block truncate text-[11px]">{theme.name.replace("Padrão ", "")}</strong>
            <span className="mt-1 flex items-center gap-1 text-[10px] text-slate-500">{active ? <><Check size={11}/>Em uso</> : owned ? "Usar" : <><Coins size={11}/>{theme.price} DC</>}</span>
          </button>;
        })}
      </div>
      {!storeReady && <p className="mt-3 text-xs leading-relaxed text-amber-200">A loja será liberada após a migration do banco. Seu tema padrão continua disponível.</p>}
    </section>

    {selected && <div className="student-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setCandidate(null); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="theme-confirm-title" className="student-dialog max-w-md p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4"><div><p className="eyebrow">Tema da interface</p><h2 id="theme-confirm-title" className="mt-2 font-display text-2xl font-bold">{selected.name}</h2></div><button autoFocus type="button" disabled={busy} onClick={() => setCandidate(null)} className="focus-ring rounded-xl border border-slate-700 p-2 text-slate-300" aria-label="Fechar"><X size={20}/></button></div>
        <div className="mt-5 flex h-24 overflow-hidden rounded-2xl border border-white/10">{selected.colors.map((color) => <span key={color} className="flex-1" style={{ background: color }}/>)}</div>
        <p className="mt-4 text-sm leading-6 text-slate-300">{selected.description}</p>
        {candidate === activeTheme ? <p className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-400/10 p-3 text-sm text-emerald-300"><Check size={17}/>Este tema já está em uso.</p> : candidateOwned ? <p className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-400/10 p-3 text-sm text-emerald-300"><Check size={17}/>Este tema já é seu. Não haverá nova cobrança.</p> : <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/8 p-4 text-sm"><p className="flex items-center justify-between"><span className="text-slate-400">Preço</span><strong className="text-amber-200">{selected.price} DC</strong></p><p className="mt-2 flex items-center justify-between"><span className="text-slate-400">Saldo após a compra</span><strong className={currentDevCoins >= selected.price ? "text-emerald-300" : "text-rose-300"}>{currentDevCoins - selected.price} DC</strong></p></div>}
        {!candidateOwned && candidate !== activeTheme && currentDevCoins < selected.price && <p className="mt-3 flex items-center gap-2 text-xs text-rose-300"><LockKeyhole size={14}/>Você precisa de {selected.price} Dev-Coins para comprar este tema.</p>}
        <button type="button" disabled={busy || candidate === activeTheme || (!candidateOwned && currentDevCoins < selected.price) || !storeReady} onClick={applyTheme} className="button-primary mt-5 w-full"><ShoppingCart size={17}/>{busy ? "Processando…" : candidateOwned ? "Aplicar tema" : `Comprar por ${selected.price} DC`}</button>
      </section>
    </div>}
  </>;
}
