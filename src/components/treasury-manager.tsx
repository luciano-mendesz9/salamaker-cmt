"use client";
import { useState } from "react";
import { Coins, Flame, PlusCircle } from "lucide-react";
import { toast } from "sonner";

type Treasury = { balance: number; totalSupply: number };
type InvestmentFund = { balance: number; targetBalance: number; coverageBps: number };
type Entry = { id: string; delta: number; reason: string; source: string; createdAt: string | Date };
type Action = "MINT" | "BURN" | "RESERVE_MINT" | "RESERVE_BURN";

export function TreasuryManager({ initialTreasury, initialFund, studentBalance, invariantGap, entries, reserveEntries }: { initialTreasury: Treasury; initialFund: InvestmentFund | null; studentBalance: number; invariantGap: number; entries: Entry[]; reserveEntries: Entry[] }) {
  const [treasury, setTreasury] = useState(initialTreasury);
  const [fund, setFund] = useState(initialFund);
  const [action, setAction] = useState<Action>(initialFund ? "RESERVE_MINT" : "MINT");
  const [amount, setAmount] = useState(initialFund ? Math.max(1, initialFund.targetBalance - initialFund.balance) : 1);
  const reserveAction = action === "RESERVE_MINT" || action === "RESERVE_BURN";
  const minting = action === "MINT" || action === "RESERVE_MINT";
  const invariantOk = invariantGap === 0;
  const canOperateDuringReconciliation = action === "RESERVE_MINT";
  const direction = minting ? 1 : -1;
  const after = { balance: treasury.balance + (reserveAction ? 0 : direction * amount), totalSupply: treasury.totalSupply + direction * amount, guaranteeBalance: (fund?.balance ?? 0) + (reserveAction ? direction * amount : 0) };
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!confirm(`${minting ? "Criar" : "Destruir"} ${amount} DC${reserveAction ? " na reserva exclusiva" : " no caixa"}? Caixa: ${treasury.balance} → ${after.balance}; reserva: ${fund?.balance ?? 0} → ${after.guaranteeBalance}; oferta: ${treasury.totalSupply} → ${after.totalSupply}.`)) return;
    const response = await fetch("/api/professor/treasury", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, amount, reason: form.get("reason"), teacherPassword: form.get("teacherPassword"), expectedBalance: treasury.balance, expectedTotalSupply: treasury.totalSupply, expectedGuaranteeBalance: fund?.balance ?? 0, confirmed: true }) });
    const data = await response.json();
    if (!response.ok) return toast.error(data.message);
    setTreasury(data.treasury);
    if (data.fund) setFund(data.fund);
    event.currentTarget.reset();
    toast.success("Oferta administrada atualizada e auditada.");
  }
  return <div className="space-y-6">
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Caixa do sistema" value={`${treasury.balance} DC`} icon={Coins}/>
      <Metric label="Reserva de investimentos" value={fund ? `${fund.balance} / ${fund.targetBalance} DC` : "Migration pendente"} icon={Coins}/>
      <Metric label="Em circulação" value={`${studentBalance} DC`} icon={Coins}/>
      <Metric label="Oferta administrada" value={`${treasury.totalSupply} DC`} icon={Coins}/>
    </section>
    <p className={`rounded-xl border p-4 text-sm ${invariantOk ? "border-emerald-400/25 bg-emerald-400/8 text-emerald-200" : "border-amber-400/25 bg-amber-400/8 text-amber-100"}`}>{invariantOk ? "Invariante conferida: caixa + reserva exclusiva + saldos dos alunos = oferta total." : <>A invariante possui uma diferença preexistente de <b>{Math.abs(invariantGap)} DC</b>. Operações comuns continuam bloqueadas até a reconciliação. O mint da reserva é permitido porque aumenta a oferta e a reserva igualmente, sem alterar essa diferença.</>}</p>
    <form onSubmit={submit} className="glass grid gap-4 rounded-2xl p-5 lg:grid-cols-2">
      <div className="lg:col-span-2"><h2 className="font-display text-xl font-bold">Ajustar oferta</h2><p className="mt-1 text-sm text-slate-400">A reserva de investimentos é segregada: não participa de compras normais e só garante resgates e dividendos.</p></div>
      <label className="text-sm">Operação<select className="input mt-2" value={action} onChange={e=>setAction(e.target.value as Action)}><option value="MINT">Mint — criar DC no caixa</option><option value="BURN">Burn — destruir DC do caixa</option>{fund && <><option value="RESERVE_MINT">Mint reserva — criar DC exclusivos de garantia</option><option value="RESERVE_BURN">Burn reserva — destruir DC livres da garantia</option></>}</select></label>
      <label className="text-sm">Quantidade<input className="input mt-2" type="number" min="1" max="1000000" value={amount} onChange={e=>setAmount(Number(e.target.value))} required/></label>
      <label className="text-sm lg:col-span-2">Motivo (10–300 caracteres)<textarea className="input mt-2 min-h-24" name="reason" minLength={10} maxLength={300} required/></label>
      <label className="text-sm">Sua senha<input className="input mt-2" name="teacherPassword" type="password" autoComplete="current-password" required/></label>
      <div className="rounded-xl border border-slate-700 p-4 text-sm"><p>Caixa: <b>{treasury.balance}</b> → <b>{after.balance}</b></p><p>Reserva: <b>{fund?.balance ?? 0}</b> → <b>{after.guaranteeBalance}</b></p><p>Oferta: <b>{treasury.totalSupply}</b> → <b>{after.totalSupply}</b></p></div>
      <button className="button-primary lg:col-span-2" disabled={(!invariantOk && !canOperateDuringReconciliation) || amount < 1 || after.balance < 0 || after.guaranteeBalance < 0}>{minting ? <PlusCircle size={18}/> : <Flame size={18}/>}Confirmar operação</button>
    </form>
    <section className="glass rounded-2xl p-5"><h2 className="font-display text-xl font-bold">Ledger do caixa</h2><div className="mt-4 divide-y divide-slate-800">{entries.map(entry=><div key={entry.id} className="flex justify-between gap-4 py-3 text-sm"><div><p>{entry.reason}</p><p className="text-xs text-slate-500">{entry.source} · {new Date(entry.createdAt).toLocaleString("pt-BR")}</p></div><b className={entry.delta > 0 ? "text-emerald-300" : "text-rose-300"}>{entry.delta > 0 ? "+" : ""}{entry.delta} DC</b></div>)}</div></section>
    {fund && <section className="glass rounded-2xl p-5"><h2 className="font-display text-xl font-bold">Ledger da reserva de investimentos</h2><div className="mt-4 divide-y divide-slate-800">{reserveEntries.length ? reserveEntries.map(entry=><div key={entry.id} className="flex justify-between gap-4 py-3 text-sm"><div><p>{entry.reason}</p><p className="text-xs text-slate-500">{entry.source} · {new Date(entry.createdAt).toLocaleString("pt-BR")}</p></div><b className={entry.delta > 0 ? "text-emerald-300" : "text-rose-300"}>{entry.delta > 0 ? "+" : ""}{entry.delta} DC</b></div>) : <p className="py-4 text-sm text-slate-500">Nenhuma movimentação na reserva.</p>}</div></section>}
  </div>;
}
function Metric({ label, value, icon: Icon }:{label:string;value:string;icon:typeof Coins}){return <div className="glass rounded-2xl p-5"><Icon className="text-amber-300"/><p className="mt-4 text-xs text-slate-400">{label}</p><p className="mt-1 font-display text-2xl font-bold">{value}</p></div>}
