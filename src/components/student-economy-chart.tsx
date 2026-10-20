type LedgerPoint = { delta: number; createdAt: string };
type SeriesPoint = { at: number; value: number };

const WIDTH = 760;
const HEIGHT = 250;
const PADDING = { top: 24, right: 18, bottom: 34, left: 18 };

function cumulativeSeries(createdAt: string, observedAt: string, current: number, entries: LedgerPoint[]) {
  const initial = current - entries.reduce((sum, entry) => sum + entry.delta, 0);
  let total = initial;
  const points = [{ at: new Date(createdAt).getTime(), value: initial }, ...entries.map(entry => ({ at: new Date(entry.createdAt).getTime(), value: total += entry.delta }))];
  points.push({ at: new Date(observedAt).getTime(), value: current });
  return points;
}

function makePath(points: SeriesPoint[], minTime: number, maxTime: number) {
  const values = points.map(point => point.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = Math.max(1, high - low);
  return points.map((point, index) => {
    const x = PADDING.left + ((point.at - minTime) / Math.max(1, maxTime - minTime)) * (WIDTH - PADDING.left - PADDING.right);
    const y = PADDING.top + (1 - (point.value - low) / span) * (HEIGHT - PADDING.top - PADDING.bottom);
    return `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

export function StudentEconomyChart({ accountCreatedAt, observedAt, currentXp, currentDevCoins, xpEntries, devCoinEntries }: { accountCreatedAt: string; observedAt: string; currentXp: number; currentDevCoins: number; xpEntries: LedgerPoint[]; devCoinEntries: LedgerPoint[] }) {
  const xp = cumulativeSeries(accountCreatedAt, observedAt, currentXp, xpEntries);
  const coins = cumulativeSeries(accountCreatedAt, observedAt, currentDevCoins, devCoinEntries);
  const allTimes = [...xp, ...coins].map(point => point.at);
  const minTime = Math.min(...allTimes);
  const maxTime = Math.max(...allTimes);
  const date = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  const xpValues = xp.map(point => point.value);
  const coinValues = coins.map(point => point.value);

  return <section className="student-card rounded-3xl p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-display text-xl font-bold">Evolução da sua jornada</h2><p className="mt-1 text-sm leading-relaxed text-slate-500">Ganhos e perdas acumulados desde a criação da conta.</p></div><div className="flex flex-wrap gap-3 text-xs font-bold"><span className="inline-flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-2 text-emerald-300"><i className="h-2.5 w-2.5 rounded-full bg-emerald-400"/>XP · {currentXp.toLocaleString("pt-BR")}</span><span className="inline-flex items-center gap-2 rounded-full bg-amber-400/10 px-3 py-2 text-amber-300"><i className="h-2.5 w-2.5 rounded-full bg-amber-400"/>Dev-Coins · {currentDevCoins.toLocaleString("pt-BR")}</span></div></div>
    <div className="mt-6 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/35 p-2 sm:p-4">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-labelledby="economy-chart-title economy-chart-description">
        <title id="economy-chart-title">Evolução de XP e Dev-Coins</title><desc id="economy-chart-description">Linha verde para o saldo acumulado de XP e linha amarela para o saldo acumulado de Dev-Coins desde a criação da conta.</desc>
        {[0, .25, .5, .75, 1].map(step => { const y = PADDING.top + step * (HEIGHT - PADDING.top - PADDING.bottom); return <line key={step} x1={PADDING.left} x2={WIDTH - PADDING.right} y1={y} y2={y} stroke="#26344a" strokeWidth="1" strokeDasharray="4 7"/>; })}
        <path d={makePath(xp, minTime, maxTime)} fill="none" stroke="#34d399" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
        <path d={makePath(coins, minTime, maxTime)} fill="none" stroke="#fbbf24" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
        <circle cx={WIDTH - PADDING.right} cy={pathEndY(xp)} r="5" fill="#34d399" stroke="#07101f" strokeWidth="3"/><circle cx={WIDTH - PADDING.right} cy={pathEndY(coins)} r="5" fill="#fbbf24" stroke="#07101f" strokeWidth="3"/>
        <text x={PADDING.left} y={HEIGHT - 8} fill="#718096" fontSize="12">{date.format(new Date(minTime))}</text><text x={WIDTH - PADDING.right} y={HEIGHT - 8} textAnchor="end" fill="#718096" fontSize="12">{date.format(new Date(maxTime))}</text>
      </svg>
    </div>
    <div className="mt-4 grid grid-cols-2 gap-3 text-xs"><p className="rounded-xl bg-emerald-400/5 p-3 text-slate-400"><strong className="block text-emerald-300">XP</strong>Menor saldo: {Math.min(...xpValues).toLocaleString("pt-BR")} · maior: {Math.max(...xpValues).toLocaleString("pt-BR")}</p><p className="rounded-xl bg-amber-400/5 p-3 text-slate-400"><strong className="block text-amber-300">Dev-Coins</strong>Menor saldo: {Math.min(...coinValues).toLocaleString("pt-BR")} · maior: {Math.max(...coinValues).toLocaleString("pt-BR")}</p></div>
    <p className="mt-3 text-xs leading-relaxed text-slate-600">Cada linha usa sua própria escala para deixar as variações legíveis. Os valores exibidos vêm do histórico registrado no sistema.</p>
  </section>;

  function pathEndY(points: SeriesPoint[]) {
    const values = points.map(point => point.value);
    const low = Math.min(...values);
    const span = Math.max(1, Math.max(...values) - low);
    return PADDING.top + (1 - (points.at(-1)!.value - low) / span) * (HEIGHT - PADDING.top - PADDING.bottom);
  }
}
