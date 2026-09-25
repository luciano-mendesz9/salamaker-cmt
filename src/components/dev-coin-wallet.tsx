"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ShoppingCart, Sparkles, X, Zap } from "lucide-react";
import { toast } from "sonner";
import devCoinImage from "@/assets/dev-coin.webp";
import { devCoinsForXp } from "@/lib/dev-coins";

type Props = { currentDevCoins: number; currentXp: number; devCoinsPerXp: number };

export function DevCoinWallet({ currentDevCoins, currentXp, devCoinsPerXp }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [xpAmount, setXpAmount] = useState(1);
  const [xpOverride, setXpOverride] = useState<number | null>(null);
  const [rateOverride, setRateOverride] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const xp = xpOverride ?? currentXp;
  const rate = rateOverride ?? devCoinsPerXp;
  const quantity = useMemo(() => Number.isInteger(xpAmount) && xpAmount >= 1 ? devCoinsForXp(xpAmount, rate) : 0, [xpAmount, rate]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) setOpen(false); };
    document.addEventListener("keydown", closeOnEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", closeOnEscape); document.body.style.overflow = previousOverflow; };
  }, [open, busy]);

  async function purchase() {
    if (busy || !Number.isInteger(xpAmount) || xpAmount < 1 || xpAmount > xp) return;
    setBusy(true);
    const response = await fetch("/api/student/dev-coins", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ xpAmount, expectedRate: rate }) });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      if (response.status === 409 && Number.isInteger(data.rate)) setRateOverride(data.rate);
      if (response.status === 409 && Number.isInteger(data.xp)) setXpOverride(data.xp);
      toast.error(data.message ?? "Não foi possível comprar Dev-Coins.");
      return;
    }
    setRateOverride(null);
    setXpOverride(null);
    toast.success(`${data.quantity} Dev-Coin${data.quantity === 1 ? " comprada" : "s compradas"} por ${data.xpCost} XP.`);
    setOpen(false);
    setXpAmount(1);
    router.refresh();
  }

  return <>
    <button type="button" onClick={() => setOpen(true)} className="focus-ring group flex w-full items-center gap-3 rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 text-left transition hover:border-amber-300/55 hover:bg-amber-300/15" aria-label={`${currentDevCoins} Dev-Coins. Abrir compra de moedas`}>
      <span className="relative block h-12 w-12 shrink-0 transition group-hover:scale-105"><Image src={devCoinImage} alt="" fill sizes="48px" className="object-contain drop-shadow-[0_5px_10px_rgba(245,158,11,.35)]" /></span>
      <span><span className="block text-xs font-bold uppercase tracking-wider text-amber-200/75">Minhas Dev-Coins</span><strong className="mt-1 block font-display text-2xl text-amber-200">{currentDevCoins}</strong></span>
      <span className="ml-auto text-right text-xs font-bold text-amber-200"><Sparkles className="ml-auto mb-1" size={17} />Comprar</span>
    </button>
    {open && <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="dev-coin-title" className="glass w-full max-w-md rounded-3xl p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><span className="relative block h-14 w-14"><Image src={devCoinImage} alt="" fill sizes="56px" className="object-contain" /></span><div><p className="eyebrow">Carteira digital</p><h2 id="dev-coin-title" className="mt-1 font-display text-2xl font-bold">Comprar Dev-Coins</h2></div></div><button autoFocus type="button" disabled={busy} onClick={() => setOpen(false)} className="focus-ring rounded-xl border border-slate-700 p-2 text-slate-300" aria-label="Fechar compra"><X size={20} /></button></div>
        <div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-amber-300/10 p-4"><p className="text-xs text-amber-100/70">Saldo</p><p className="mt-1 text-xl font-bold text-amber-200">{currentDevCoins} moedas</p></div><div className="rounded-2xl bg-blue-400/10 p-4"><p className="text-xs text-blue-100/70">XP disponível</p><p className="mt-1 text-xl font-bold text-blue-200">{xp} XP</p></div></div>
        <p className="mt-5 text-sm leading-6 text-slate-300">Cotação atual: <strong className="text-white">1 XP = {rate} Dev-Coin{rate === 1 ? "" : "s"}</strong>. A troca fica registrada nos dois históricos.</p>
        <label className="mt-5 block text-sm font-bold"><span className="mb-2 block">Quantos XP deseja trocar?</span><input type="number" min="1" max="10000" value={xpAmount} onChange={(event) => setXpAmount(Number(event.target.value))} className="input" /></label>
        <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-950/40 p-4 text-sm"><p className="flex items-center justify-between"><span className="text-slate-400">Você receberá</span><strong className="text-amber-200">{quantity} Dev-Coin{quantity === 1 ? "" : "s"}</strong></p><p className="mt-2 flex items-center justify-between"><span className="text-slate-400">Seu novo saldo de XP</span><strong className={xpAmount <= xp ? "text-emerald-300" : "text-rose-300"}><span className="inline-flex items-center gap-1"><Zap size={15} />{xp - xpAmount} XP</span></strong></p></div>
        {xpAmount > xp && <p className="mt-3 text-sm text-rose-300">Você não tem essa quantidade de XP disponível.</p>}
        <button type="button" disabled={busy || !Number.isInteger(xpAmount) || xpAmount < 1 || xpAmount > 10_000 || xpAmount > xp} onClick={purchase} className="button-primary mt-5 w-full"><ShoppingCart size={17} />{busy ? "Processando…" : "Confirmar troca"}</button>
      </section>
    </div>}
  </>;
}
