"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRightLeft, Clock3, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { DEV_COIN_TO_XP_LIMIT, devCoinsRequiredForXp } from "@/lib/dev-coin-to-xp-policy";

type Quota = { used: number; remaining: number; nextAvailableAt: string | null };
type Props = { currentDevCoins: number; currentXp: number; rate: number; initialQuota: Quota; ready: boolean; observedAt: string };

function countdown(target: string | null, now: number) {
  if (!target) return null;
  const seconds = Math.max(0, Math.ceil((new Date(target).getTime() - now) / 1_000));
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor(seconds % 3_600 / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function DevCoinToXp({ currentDevCoins, currentXp, rate, initialQuota, ready, observedAt }: Props) {
  const router = useRouter();
  const [quota, setQuota] = useState(initialQuota);
  const [coins, setCoins] = useState(currentDevCoins);
  const [xp, setXp] = useState(currentXp);
  const [now, setNow] = useState(() => new Date(observedAt).getTime());
  const [open, setOpen] = useState(false);
  const [xpAmount, setXpAmount] = useState(1);
  const [password, setPassword] = useState("");
  const [requestId, setRequestId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const refreshedTarget = useRef<string | null>(null);

  useEffect(() => {
    const serverOffsetMs = new Date(observedAt).getTime() - Date.now();
    const timer = window.setInterval(() => setNow(Date.now() + serverOffsetMs), 1_000);
    return () => window.clearInterval(timer);
  }, [observedAt]);
  useEffect(() => {
    const target = quota.nextAvailableAt;
    if (target && now >= new Date(target).getTime() && refreshedTarget.current !== target) {
      refreshedTarget.current = target;
      router.refresh();
    }
  }, [now, quota.nextAvailableAt, router]);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) setOpen(false); };
    document.addEventListener("keydown", onEscape);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", onEscape); };
  }, [open, busy]);

  const price = Number.isInteger(xpAmount) && xpAmount >= 1 && xpAmount <= DEV_COIN_TO_XP_LIMIT ? devCoinsRequiredForXp(xpAmount, rate) : 0;
  const available = Math.min(quota.remaining, Math.floor(coins / (rate * 10)));
  const valid = ready && Number.isInteger(xpAmount) && xpAmount >= 1 && xpAmount <= available && password.length > 0;

  async function convert() {
    if (busy || !valid) return;
    const id = requestId ?? crypto.randomUUID();
    setRequestId(id);
    setBusy(true);
    try {
      const response = await fetch("/api/student/dev-coins/to-xp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ xpAmount, expectedRate: rate, requestId: id, studentPassword: password }) });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.message ?? "Não foi possível converter DevCoins em XP.");
      setCoins(result.devCoins);
      setXp(result.xp);
      setQuota(result.quota);
      setPassword("");
      setXpAmount(1);
      setRequestId(undefined);
      setOpen(false);
      toast.success(`${result.devCoinsSpent} DevCoins convertidas em ${result.xpReceived} XP.`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível converter DevCoins em XP.");
      router.refresh();
    } finally { setBusy(false); }
  }

  const remainingTime = countdown(quota.nextAvailableAt, now);
  return <>
    <section className="mt-3 rounded-2xl border border-[color-mix(in_srgb,var(--accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--accent)_9%,transparent)] p-4" aria-label="Converter DevCoins em XP">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-[var(--accent-soft)]"><ArrowRightLeft size={22} aria-hidden="true"/></span>
        <div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-[.16em] text-[var(--accent-soft)]">Troca opcional</p><h3 className="mt-1 text-sm font-bold">DevCoins em XP</h3><p className="mt-1 text-xs leading-relaxed text-slate-400">{rate * 10} DevCoins = 1 XP · até 20 XP em 48 horas</p></div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/30 px-3 py-2.5 text-xs"><span className="text-slate-400">Cota disponível</span><strong className="text-[var(--accent-soft)]">{quota.remaining} de 20 XP</strong></div>
      <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/30 px-3 py-2.5 text-xs"><span className="inline-flex items-center gap-1.5 text-slate-400"><Clock3 size={14}/>Próxima liberação</span><strong className="tabular-nums text-slate-100">{remainingTime ?? "Após a primeira troca"}</strong></div>
      {!ready && <p className="mt-3 text-xs text-amber-200">A conversão aguarda a atualização do banco de dados.</p>}
      <button type="button" disabled={!ready || available < 1} onClick={() => setOpen(true)} className="button-secondary mt-3 w-full disabled:cursor-not-allowed disabled:opacity-50"><Zap size={16}/>Converter DevCoins</button>
    </section>
    {open && <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="dev-coin-to-xp-title" className="glass w-full max-w-md rounded-3xl p-6 sm:p-7">
        <div className="flex items-start justify-between gap-3"><div><p className="eyebrow">Troca opcional</p><h2 id="dev-coin-to-xp-title" className="mt-1 font-display text-2xl font-bold">DevCoins em XP</h2></div><button autoFocus type="button" disabled={busy} onClick={() => setOpen(false)} className="focus-ring rounded-xl border border-slate-700 p-2 text-slate-300" aria-label="Fechar conversão"><X size={20}/></button></div>
        <p className="mt-4 text-sm leading-relaxed text-slate-300">A cotação é <strong className="text-white">{rate * 10} DevCoins por 1 XP</strong>. Você pode receber até {quota.remaining} XP agora. Cada troca sai da cota após 48 horas.</p>
        <label className="mt-5 block text-sm font-bold">Quantos XP deseja receber?<input className="input mt-2" type="number" min="1" max={available} step="1" value={xpAmount} onChange={event => { setXpAmount(Number(event.target.value)); setRequestId(undefined); }} required/></label>
        <label className="mt-4 block text-sm font-bold">Sua senha atual<input className="input mt-2" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required/></label>
        <div className="mt-4 space-y-2 rounded-2xl border border-slate-700 bg-slate-950/40 p-4 text-sm"><p className="flex justify-between gap-2"><span className="text-slate-400">Você gastará</span><strong>{price} DevCoins</strong></p><p className="flex justify-between gap-2"><span className="text-slate-400">Você receberá</span><strong className="text-[var(--accent-soft)]">{xpAmount} XP</strong></p><p className="flex justify-between gap-2"><span className="text-slate-400">Novos saldos</span><strong>{coins - price} DC · {xp + xpAmount} XP</strong></p></div>
        <p className="mt-3 text-xs leading-relaxed text-slate-400">As moedas vão para o caixa do sistema. O XP recebido participa do ajuste mensal de XP; a troca é registrada nos dois históricos.</p>
        <button type="button" disabled={busy || !valid} onClick={convert} className="button-primary mt-5 w-full"><ArrowRightLeft size={17}/>{busy ? "Convertendo…" : "Confirmar conversão"}</button>
      </section>
    </div>}
  </>;
}
