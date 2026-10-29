"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowDownToLine, ChartNoAxesCombined, Coins, Landmark, LockKeyhole, PiggyBank, ShieldCheck, Sparkles, TrendingUp, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { isValidInvestmentAmount, maximumInvestmentPayout, requiredGuarantee, xpFeeForApplication, type InvestmentProductKey } from "@/lib/investment-rules";

type Product = { key: InvestmentProductKey; name: string; minimumWeeks: number; weeklyRateBps: number };
type Position = { id: string; product: InvestmentProductKey; principal: number; weeklyRateBps: number; xpFee: number; appliedAt: string; unlockAt: string; yieldEndsAt: string; weeks: number; value: number; dividends: number };
type History = { id: string; type: "APPLICATION" | "REDEMPTION"; principalAmount: number; dividendAmount: number; createdAt: string };
type GraphPoint = { date: string; applied: number; redeemed: number };
type Portfolio = {
  observedAt: string;
  xp: number;
  devCoins: number;
  products: readonly Product[];
  dailyRemaining: number;
  investedToday: number;
  xpBaseToday: number;
  xpFeePaidToday: number;
  blockSize: number;
  fund: { balance: number; targetBalance: number; coverageBps: number; maximumPayoutLiability: number; requiredGuarantee: number; availableGuarantee: number };
  active: Position[];
  history: History[];
  graph: GraphPoint[];
};

const productIcons = { MAKER_SAVINGS: PiggyBank, MAKER_BOND: Landmark, MAKER_BOND_PLUS: TrendingUp } as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Fortaleza", day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function productName(products: readonly Product[], key: InvestmentProductKey) {
  return products.find((product) => product.key === key)?.name ?? key;
}

export function InvestmentDashboard({ portfolio }: { portfolio: Portfolio }) {
  const router = useRouter();
  const [product, setProduct] = useState<InvestmentProductKey>("MAKER_SAVINGS");
  const [amount, setAmount] = useState(1_000);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [requestId, setRequestId] = useState<string>();
  const [redeeming, setRedeeming] = useState<Position | null>(null);
  const [redeemPassword, setRedeemPassword] = useState("");
  const [redeemRequestId, setRedeemRequestId] = useState<string>();
  const selected = portfolio.products.find((item) => item.key === product) ?? portfolio.products[0];
  const activePrincipal = portfolio.active.reduce((total, position) => total + position.principal, 0);
  const currentDividends = portfolio.active.reduce((total, position) => total + position.dividends, 0);
  const xpFee = useMemo(() => {
    try { return xpFeeForApplication(portfolio.xpBaseToday, portfolio.investedToday, portfolio.xpFeePaidToday, amount); } catch { return null; }
  }, [amount, portfolio.investedToday, portfolio.xpBaseToday, portfolio.xpFeePaidToday]);
  const validProductAmount = isValidInvestmentAmount(product, amount);
  const hasCapacity = validProductAmount && requiredGuarantee(portfolio.fund.maximumPayoutLiability + maximumInvestmentPayout(amount, selected.weeklyRateBps), portfolio.fund.coverageBps) <= portfolio.fund.balance;
  const canApply = portfolio.fund.balance > 0 && validProductAmount && hasCapacity && amount <= portfolio.dailyRemaining && amount <= portfolio.devCoins && xpFee !== null && xpFee <= portfolio.xp;

  function resetRequest() { setRequestId(undefined); }

  async function apply() {
    if (busy || !canApply || !password) return;
    const id = requestId ?? crypto.randomUUID();
    setRequestId(id); setBusy(true);
    try {
      const response = await fetch("/api/student/investments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ product, amount, studentPassword: password, requestId: id }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message ?? "Não foi possível realizar a aplicação.");
      toast.success(`${amount.toLocaleString("pt-BR")} DC aplicados no ${selected.name}.`);
      setPassword(""); setRequestId(undefined); router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível realizar a aplicação."); }
    finally { setBusy(false); }
  }

  async function redeem() {
    if (!redeeming || busy || !redeemPassword) return;
    const id = redeemRequestId ?? crypto.randomUUID();
    setRedeemRequestId(id); setBusy(true);
    try {
      const response = await fetch(`/api/student/investments/${redeeming.id}/redeem`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ studentPassword: redeemPassword, requestId: id }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message ?? "Não foi possível realizar o resgate.");
      toast.success(`Resgate concluído: ${data.payout} DC, incluindo ${data.dividends} DC de dividendos.`);
      setRedeeming(null); setRedeemPassword(""); setRedeemRequestId(undefined); router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível realizar o resgate."); }
    finally { setBusy(false); }
  }

  return <main className="mobile-safe"><div className="student-page mx-auto max-w-[1180px] space-y-5 lg:space-y-6">
    <section className="student-dashboard-hero relative overflow-hidden rounded-3xl border p-6 sm:p-8">
      <div className="relative z-10 max-w-2xl"><p className="eyebrow flex items-center gap-2"><TrendingUp size={15}/>Índice Maker acelerado</p><h1 className="mt-4 font-display text-3xl font-black sm:text-4xl">Carteira de investimentos</h1><p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">Acompanhe juros compostos em semanas. Esta é uma simulação didática com Dev-Coins, sem valor financeiro real.</p></div>
      <ChartNoAxesCombined className="absolute -bottom-8 -right-6 text-[color-mix(in_srgb,var(--accent)_16%,transparent)]" size={190}/>
    </section>

    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Metric icon={Coins} label="Saldo disponível" value={`${portfolio.devCoins.toLocaleString("pt-BR")} DC`}/>
      <Metric icon={Landmark} label="Principal aplicado" value={`${activePrincipal.toLocaleString("pt-BR")} DC`}/>
      <Metric icon={Sparkles} label="Dividendos atuais" value={`+${currentDividends.toLocaleString("pt-BR")} DC`} tone="emerald"/>
      <Metric icon={ShieldCheck} label="Garantia da carteira" value={portfolio.fund.balance > 0 ? `${Math.floor(portfolio.fund.coverageBps / 100)}% mínimo` : "Aguardando ativação"}/>
    </section>

    <InvestmentChart data={portfolio.graph}/>

    <section className="grid gap-5 xl:grid-cols-[1.18fr_.82fr]">
      <div className="student-card rounded-3xl p-5 sm:p-6">
        <div><p className="eyebrow">Escolha seu prazo</p><h2 className="mt-2 font-display text-2xl font-black">Nova aplicação</h2><p className="mt-2 text-sm text-slate-400">O Cofrinho aceita de 1 a 1.000 DC. A taxa é proporcional, equivalente a 5% do XP-base por 1.000 DC, e arredondada para cima.</p></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">{portfolio.products.map((item) => { const Icon = productIcons[item.key]; const active = item.key === product; return <button key={item.key} type="button" onClick={() => { setProduct(item.key); setAmount(1_000); resetRequest(); }} className={`focus-ring rounded-2xl border p-4 text-left transition ${active ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_13%,transparent)]" : "border-slate-700 bg-white/3 hover:border-[color-mix(in_srgb,var(--accent)_45%,var(--line))]"}`}><Icon className="text-[var(--accent-soft)]" size={22}/><strong className="mt-3 block text-sm">{item.name}</strong><span className="mt-1 block text-xs text-slate-400">{item.minimumWeeks} {item.minimumWeeks === 1 ? "semana" : "semanas"} · {(item.weeklyRateBps / 100).toLocaleString("pt-BR")}%/semana</span></button>; })}</div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {product === "MAKER_SAVINGS" ? <label className="text-sm font-bold">Valor personalizado (1–1.000 DC)<input className="input mt-2" type="number" inputMode="numeric" min="1" max="1000" step="1" value={amount} onChange={(event) => { setAmount(Number(event.target.value)); resetRequest(); }} required/></label> : <label className="text-sm font-bold">Valor da aplicação<select className="input mt-2" value={amount} onChange={(event) => { setAmount(Number(event.target.value)); resetRequest(); }}>{[1_000, 2_000, 3_000].map((value) => <option key={value} value={value} disabled={value > portfolio.dailyRemaining}>{value.toLocaleString("pt-BR")} DC</option>)}</select></label>}
          <label className="text-sm font-bold">Sua senha atual<input className="input mt-2" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required/></label>
        </div>
        <div className="mt-4 grid gap-3 rounded-2xl border border-slate-700 bg-slate-950/25 p-4 text-sm sm:grid-cols-3"><Preview label="Taxa desta aplicação" value={xpFee === null ? "—" : `${xpFee} XP`} icon={Zap}/><Preview label="Prazo mínimo" value={`${selected.minimumWeeks} ${selected.minimumWeeks === 1 ? "semana" : "semanas"}`} icon={LockKeyhole}/><Preview label="Rendimento semanal" value={`${selected.weeklyRateBps / 100}%`} icon={TrendingUp}/></div>
        <p className="mt-3 text-xs text-slate-500">Limite restante hoje: {portfolio.dailyRemaining.toLocaleString("pt-BR")} DC · O rendimento para após 8 semanas.</p>
        {portfolio.fund.balance === 0 && <p className="mt-3 rounded-xl border border-amber-300/25 bg-amber-300/8 p-3 text-sm text-amber-200">A reserva de garantia ainda não foi ativada pelo professor.</p>}
        {portfolio.fund.balance > 0 && !hasCapacity && <p className="mt-3 rounded-xl border border-amber-300/25 bg-amber-300/8 p-3 text-sm text-amber-200">A reserva atingiu o limite seguro para este produto ou valor.</p>}
        <button type="button" onClick={apply} disabled={busy || !password || !canApply} className="button-primary mt-5 w-full"><TrendingUp size={18}/>{busy ? "Processando…" : `Aplicar ${amount.toLocaleString("pt-BR")} DC`}</button>
      </div>

      <section className="student-card rounded-3xl p-5 sm:p-6"><p className="eyebrow">Segurança</p><h2 className="mt-2 font-display text-xl font-bold">Reserva de garantia</h2><div className="mt-5 space-y-4"><FundRow label="Reserva exclusiva" value={`${portfolio.fund.balance.toLocaleString("pt-BR")} DC`}/><FundRow label="Obrigações máximas" value={`${portfolio.fund.maximumPayoutLiability.toLocaleString("pt-BR")} DC`}/><FundRow label="Garantia exigida" value={`${portfolio.fund.requiredGuarantee.toLocaleString("pt-BR")} DC`}/><FundRow label="Margem disponível" value={`${portfolio.fund.availableGuarantee.toLocaleString("pt-BR")} DC`}/></div><p className="mt-5 rounded-2xl bg-[color-mix(in_srgb,var(--accent)_9%,transparent)] p-4 text-xs leading-5 text-slate-400">O valor aplicado vai ao caixa de circulação. A reserva é separada e só pode cobrir resgates e dividendos.</p></section>
    </section>

    <section className="student-card rounded-3xl p-5 sm:p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">Juros sobre juros</p><h2 className="mt-2 font-display text-2xl font-black">Meus investimentos ativos</h2></div><span className="text-xs text-slate-500">Valores atualizados por semanas completas</span></div>{portfolio.active.length ? <div className="mt-5 grid gap-4 lg:grid-cols-2">{portfolio.active.map((position) => { const unlocked = new Date(portfolio.observedAt) >= new Date(position.unlockAt); return <article key={position.id} className="rounded-2xl border border-slate-700 bg-white/3 p-5"><div className="flex items-start justify-between gap-3"><div><strong>{productName(portfolio.products, position.product)}</strong><p className="mt-1 text-xs text-slate-500">Aplicado em {formatDate(position.appliedAt)}</p></div><span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-300">{position.weeklyRateBps / 100}%/sem.</span></div><div className="mt-5 grid grid-cols-3 gap-2 text-sm"><Value label="Principal" value={`${position.principal} DC`}/><Value label="Dividendos" value={`+${position.dividends} DC`} good/><Value label="Saldo atual" value={`${position.value} DC`}/></div><div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-500"><span>Semana {position.weeks} de 8</span><span>{unlocked ? "Resgate liberado" : `Libera em ${formatDate(position.unlockAt)}`}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.max(3, position.weeks / 8 * 100)}%` }}/></div><button type="button" disabled={!unlocked} onClick={() => { setRedeeming(position); setRedeemRequestId(undefined); }} className="button-secondary mt-4 w-full"><ArrowDownToLine size={17}/>{unlocked ? "Resgatar principal + dividendos" : "Prazo mínimo em andamento"}</button></article>; })}</div> : <div className="mt-5 rounded-2xl border border-dashed border-slate-700 p-8 text-center"><PiggyBank className="mx-auto text-slate-500" size={32}/><p className="mt-3 text-sm font-bold">Você ainda não possui investimentos ativos.</p></div>}</section>

    <section className="student-card rounded-3xl p-5 sm:p-6"><h2 className="font-display text-xl font-bold">Histórico da carteira</h2>{portfolio.history.length ? <div className="mt-4 divide-y divide-slate-800">{portfolio.history.map((item) => <div key={item.id} className="flex items-center justify-between gap-4 py-4 text-sm"><div><strong>{item.type === "APPLICATION" ? "Aplicação" : "Resgate"}</strong><p className="mt-1 text-xs text-slate-500">{formatDate(item.createdAt)}{item.type === "REDEMPTION" ? ` · dividendos: ${item.dividendAmount} DC` : ""}</p></div><b className={item.type === "APPLICATION" ? "text-emerald-300" : "text-rose-300"}>{item.principalAmount.toLocaleString("pt-BR")} DC</b></div>)}</div> : <p className="mt-4 text-sm text-slate-500">As aplicações e resgates aparecerão aqui.</p>}</section>
  </div>

  {redeeming && <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setRedeeming(null); }}><section role="dialog" aria-modal="true" aria-labelledby="redeem-title" className="glass w-full max-w-md rounded-3xl p-6"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">Confirmar operação</p><h2 id="redeem-title" className="mt-2 font-display text-2xl font-bold">Resgatar investimento</h2></div><button type="button" disabled={busy} onClick={() => setRedeeming(null)} className="focus-ring rounded-xl border border-slate-700 p-2" aria-label="Fechar"><X size={19}/></button></div><div className="mt-5 rounded-2xl bg-emerald-400/8 p-4 text-sm"><p className="flex justify-between"><span>Principal</span><strong>{redeeming.principal} DC</strong></p><p className="mt-2 flex justify-between"><span>Dividendos</span><strong className="text-emerald-300">+{redeeming.dividends} DC</strong></p><p className="mt-3 flex justify-between border-t border-emerald-300/15 pt-3"><span>Total</span><strong>{redeeming.value} DC</strong></p></div><label className="mt-5 block text-sm font-bold">Sua senha atual<input className="input mt-2" type="password" autoComplete="current-password" value={redeemPassword} onChange={(event) => { setRedeemPassword(event.target.value); setRedeemRequestId(undefined); }} required/></label><button type="button" onClick={redeem} disabled={busy || !redeemPassword} className="button-primary mt-5 w-full"><ArrowDownToLine size={17}/>{busy ? "Resgatando…" : "Confirmar resgate"}</button></section></div>}
  </main>;
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof Coins; label: string; value: string; tone?: "emerald" }) { return <div className="student-card rounded-2xl p-4 sm:p-5"><Icon className={tone === "emerald" ? "text-emerald-300" : "text-[var(--accent-soft)]"} size={20}/><p className="mt-4 text-xs text-slate-400">{label}</p><p className={`mt-1 font-display text-xl font-black ${tone === "emerald" ? "text-emerald-300" : ""}`}>{value}</p></div>; }
function Preview({ icon: Icon, label, value }: { icon: typeof Zap; label: string; value: string }) { return <div><Icon className="text-[var(--accent-soft)]" size={16}/><p className="mt-2 text-xs text-slate-500">{label}</p><strong className="mt-1 block">{value}</strong></div>; }
function FundRow({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-3 text-sm"><span className="text-slate-400">{label}</span><strong>{value}</strong></div>; }
function Value({ label, value, good }: { label: string; value: string; good?: boolean }) { return <div><p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p><strong className={`mt-1 block ${good ? "text-emerald-300" : ""}`}>{value}</strong></div>; }

function InvestmentChart({ data }: { data: GraphPoint[] }) {
  const width = 760, height = 260, left = 54, right = 18, top = 24, bottom = 42;
  const max = Math.max(1, ...data.flatMap((point) => [point.applied, point.redeemed]));
  const x = (index: number) => data.length <= 1 ? left : left + index * (width - left - right) / (data.length - 1);
  const y = (value: number) => top + (max - value) * (height - top - bottom) / max;
  const path = (key: "applied" | "redeemed") => data.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(point[key]).toFixed(1)}`).join(" ");
  return <section className="student-card rounded-3xl p-5 sm:p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">Evolução diária</p><h2 className="mt-2 font-display text-xl font-bold">Aplicações × resgates</h2></div><div className="flex gap-4 text-xs"><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-emerald-400"/>Valores aplicados</span><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-rose-400"/>Principal resgatado, sem dividendos</span></div></div><div className="mt-5 overflow-x-auto"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Gráfico acumulado de valores aplicados e principal resgatado" className="min-w-[620px] overflow-visible"><defs><linearGradient id="investment-green" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#34d399" stopOpacity=".24"/><stop offset="1" stopColor="#34d399" stopOpacity="0"/></linearGradient></defs>{[0, .25, .5, .75, 1].map((ratio) => { const yy = top + ratio * (height - top - bottom); const value = Math.round(max * (1 - ratio)); return <g key={ratio}><line x1={left} x2={width-right} y1={yy} y2={yy} stroke="currentColor" opacity=".09"/><text x={left-8} y={yy+4} textAnchor="end" fontSize="11" fill="currentColor" opacity=".55">{value}</text></g>; })}<path d={`${path("applied")} L${x(data.length-1)},${height-bottom} L${x(0)},${height-bottom} Z`} fill="url(#investment-green)"/><path d={path("applied")} fill="none" stroke="#34d399" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/><path d={path("redeemed")} fill="none" stroke="#fb7185" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>{data.map((point, index) => <g key={point.date}><circle cx={x(index)} cy={y(point.applied)} r="3.5" fill="#34d399"/><circle cx={x(index)} cy={y(point.redeemed)} r="3.5" fill="#fb7185"/></g>)}<text x={left} y={height-14} fontSize="11" fill="currentColor" opacity=".55">{new Date(`${data[0].date}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" })}</text><text x={width-right} y={height-14} textAnchor="end" fontSize="11" fill="currentColor" opacity=".55">{new Date(`${data.at(-1)!.date}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" })}</text></svg></div></section>;
}
