"use client";
import { useState } from "react";
import { Coins, Flame, PlusCircle } from "lucide-react";
import { toast } from "sonner";

type Treasury = { balance: number; totalSupply: number };
type Entry = { id: string; delta: number; reason: string; source: string; createdAt: string | Date };

export function TreasuryManager({ initialTreasury, studentBalance, invariantOk, entries }: { initialTreasury: Treasury; studentBalance: number; invariantOk: boolean; entries: Entry[] }) {
  const [treasury, setTreasury] = useState(initialTreasury);
  const [action, setAction] = useState<"MINT" | "BURN">("MINT");
  const [amount, setAmount] = useState(1);
  const after = { balance: treasury.balance + (action === "MINT" ? amount : -amount), totalSupply: treasury.totalSupply + (action === "MINT" ? amount : -amount) };
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!confirm(`${action === "MINT" ? "Criar" : "Destruir"} ${amount} DC? Caixa: ${treasury.balance} → ${after.balance}; oferta: ${treasury.totalSupply} → ${after.totalSupply}.`)) return;
    const response = await fetch("/api/professor/treasury", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, amount, reason: form.get("reason"), teacherPassword: form.get("teacherPassword"), expectedBalance: treasury.balance, expectedTotalSupply: treasury.totalSupply, confirmed: true }) });
    const data = await response.json();
    if (!response.ok) return toast.error(data.message);
    setTreasury(data.treasury);
    event.currentTarget.reset();
    toast.success("Oferta administrada atualizada e auditada.");
  }
  return <div className="space-y-6">
    <section className="grid gap-4 sm:grid-cols-3">
      <Metric label="Caixa do sistema" value={`${treasury.balance} DC`} icon={Coins}/>
      <Metric label="Em circulação" value={`${studentBalance} DC`} icon={Coins}/>
      <Metric label="Oferta administrada" value={`${treasury.totalSupply} DC`} icon={Coins}/>
    </section>
    <p className={`rounded-xl border p-4 text-sm ${invariantOk ? "border-emerald-400/25 bg-emerald-400/8 text-emerald-200" : "border-rose-400/25 bg-rose-400/8 text-rose-200"}`}>{invariantOk ? "Invariante conferida: caixa + saldos dos alunos = oferta total." : "Atenção: a invariante está divergente. Não faça ajustes antes de reconciliar."}</p>
    <form onSubmit={submit} className="glass grid gap-4 rounded-2xl p-5 lg:grid-cols-2">
      <div className="lg:col-span-2"><h2 className="font-display text-xl font-bold">Ajustar oferta</h2><p className="mt-1 text-sm text-slate-400">Mint adiciona ao caixa; burn remove somente do caixa. Saldos de alunos não são editados.</p></div>
      <label className="text-sm">Operação<select className="input mt-2" value={action} onChange={e=>setAction(e.target.value as "MINT"|"BURN")}><option value="MINT">Mint — criar DC no caixa</option><option value="BURN">Burn — destruir DC do caixa</option></select></label>
      <label className="text-sm">Quantidade<input className="input mt-2" type="number" min="1" max="1000000" value={amount} onChange={e=>setAmount(Number(e.target.value))} required/></label>
      <label className="text-sm lg:col-span-2">Motivo (10–300 caracteres)<textarea className="input mt-2 min-h-24" name="reason" minLength={10} maxLength={300} required/></label>
      <label className="text-sm">Sua senha<input className="input mt-2" name="teacherPassword" type="password" autoComplete="current-password" required/></label>
      <div className="rounded-xl border border-slate-700 p-4 text-sm"><p>Caixa: <b>{treasury.balance}</b> → <b>{after.balance}</b></p><p>Oferta: <b>{treasury.totalSupply}</b> → <b>{after.totalSupply}</b></p></div>
      <button className="button-primary lg:col-span-2" disabled={!invariantOk || amount < 1 || after.balance < 0}>{action === "MINT" ? <PlusCircle size={18}/> : <Flame size={18}/>}Confirmar {action.toLowerCase()}</button>
    </form>
    <section className="glass rounded-2xl p-5"><h2 className="font-display text-xl font-bold">Ledger do caixa</h2><div className="mt-4 divide-y divide-slate-800">{entries.map(entry=><div key={entry.id} className="flex justify-between gap-4 py-3 text-sm"><div><p>{entry.reason}</p><p className="text-xs text-slate-500">{entry.source} · {new Date(entry.createdAt).toLocaleString("pt-BR")}</p></div><b className={entry.delta > 0 ? "text-emerald-300" : "text-rose-300"}>{entry.delta > 0 ? "+" : ""}{entry.delta} DC</b></div>)}</div></section>
  </div>;
}
function Metric({ label, value, icon: Icon }:{label:string;value:string;icon:typeof Coins}){return <div className="glass rounded-2xl p-5"><Icon className="text-amber-300"/><p className="mt-4 text-xs text-slate-400">{label}</p><p className="mt-1 font-display text-2xl font-bold">{value}</p></div>}
