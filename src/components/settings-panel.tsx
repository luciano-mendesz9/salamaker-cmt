"use client";

import Image from "next/image";
import { useState } from "react";
import { Coins, Palette, Power } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import devCoinImage from "@/assets/dev-coin.webp";

const colors = ["#328fff", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#f43f5e"];

export function SettingsPanel({ initial }: { initial: { accentColor: string; studentAreaEnabled: boolean; devCoinsPerXp: number } }) {
  const router = useRouter();
  const [color, setColor] = useState(initial.accentColor);
  const [enabled, setEnabled] = useState(initial.studentAreaEnabled);
  const [rate, setRate] = useState(initial.devCoinsPerXp);
  const [savedRate, setSavedRate] = useState(initial.devCoinsPerXp);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(body: unknown) {
    setBusy(true);
    const response = await fetch("/api/professor/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) { toast.error(data.message); return false; }
    toast.success("Configuração atualizada.");
    router.refresh();
    return true;
  }
  return <div className="grid gap-5 lg:grid-cols-2">
    <section className="glass rounded-2xl p-6">
      <span className={`grid h-11 w-11 place-items-center rounded-xl ${enabled ? "bg-emerald-400/10 text-emerald-300" : "bg-rose-400/10 text-rose-300"}`}><Power /></span>
      <h2 className="mt-5 font-display text-xl font-bold">Área dos alunos</h2><p className="mt-2 text-sm leading-relaxed text-slate-400">{enabled ? "A área dos alunos está disponível." : "O site foi desativado temporariamente pelo professor."}</p>
      <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" className="input mt-5" placeholder="Sua senha de professor" />
      <button disabled={busy || !password} onClick={async () => { if (await save({ action: "STUDENT_AREA", enabled: !enabled, teacherPassword: password })) { setEnabled(!enabled); setPassword(""); } }} className={`mt-3 rounded-xl px-4 py-3 text-sm font-bold ${enabled ? "border border-rose-400/30 bg-rose-400/10 text-rose-200" : "bg-emerald-500 text-white"}`}>{enabled ? "Desativar temporariamente" : "Reativar área dos alunos"}</button>
    </section>
    <section className="glass rounded-2xl p-6">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-400/10 text-blue-300"><Palette /></span><h2 className="mt-5 font-display text-xl font-bold">Cor de destaque global</h2><p className="mt-2 text-sm leading-relaxed text-slate-400">Escolha uma opção validada para manter contraste e legibilidade.</p>
      <div className="mt-6 flex flex-wrap gap-3">{colors.map((item) => <button key={item} onClick={() => setColor(item)} aria-label={`Selecionar ${item}`} className={`h-11 w-11 rounded-xl border-2 ${color === item ? "border-white" : "border-transparent"}`} style={{ background: item }} />)}</div>
      <button disabled={busy || color === initial.accentColor} onClick={() => save({ action: "THEME", accentColor: color })} className="button-primary mt-6 text-sm">Salvar tema</button>
    </section>
    <section className="glass rounded-2xl p-6 lg:col-span-2">
      <div className="flex items-start gap-4"><span className="relative block h-14 w-14 shrink-0"><Image src={devCoinImage} alt="" fill sizes="56px" className="object-contain" /></span><div><p className="eyebrow flex items-center gap-2"><Coins size={15} />Economia da Sala Maker</p><h2 className="mt-2 font-display text-xl font-bold">Cotação da Dev-Coin</h2></div></div>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-400">Defina quantas Dev-Coins o aluno recebe ao trocar 1 XP. Por exemplo, com o valor 3, cada 1 XP compra 3 Dev-Coins. Fotos de perfil sempre custam 20 Dev-Coins.</p>
      <label className="mt-5 block max-w-sm text-sm font-bold"><span className="mb-2 block">Dev-Coins recebidas por 1 XP</span><input type="number" min="1" max="10000" value={rate} onChange={(event) => setRate(Number(event.target.value))} className="input" /></label>
      <button disabled={busy || !Number.isInteger(rate) || rate < 1 || rate === savedRate} onClick={async () => { if (await save({ action: "DEV_COIN_RATE", devCoinsPerXp: rate })) setSavedRate(rate); }} className="button-primary mt-4 text-sm">Salvar cotação</button>
    </section>
  </div>;
}
