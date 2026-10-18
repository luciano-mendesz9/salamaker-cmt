import Link from "next/link";
import { Bot, Brain, CircleGauge, Gamepad2, ShieldCheck, Swords, Timer, Trophy, UsersRound } from "lucide-react";
import type { MinigameLogsData } from "@/lib/minigame-logs";

type Tab = "pong" | "jogo-da-velha" | "sudoku";
const date = (value: string | null) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium", timeZone: "America/Fortaleza" }).format(new Date(value)) : "—";
const duration = (seconds: number | null) => seconds === null ? "—" : `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
const tabs: { key: Tab; label: string; icon: typeof Gamepad2 }[] = [
  { key: "pong", label: "Pong", icon: Gamepad2 },
  { key: "jogo-da-velha", label: "Jogo da Velha", icon: Swords },
  { key: "sudoku", label: "Sudoku", icon: Brain },
];

export function MinigameLogs({ data, activeTab }: { data: MinigameLogsData; activeTab: Tab }) {
  return <>
    <nav aria-label="Jogos" className="mt-7 flex gap-2 overflow-x-auto pb-2">{tabs.map(({ key, label, icon: Icon }) => <Link key={key} href={`/professor/logs/minigames?jogo=${key}`} className={`focus-ring flex shrink-0 items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold ${activeTab === key ? "bg-blue-400 text-slate-950" : "border border-slate-700 bg-slate-900/60 text-slate-300"}`}><Icon size={17}/>{label}</Link>)}</nav>
    {activeTab === "pong" && <PongLogs rows={data.pong}/>}
    {activeTab === "jogo-da-velha" && <TicTacToeLogs rows={data.ticTacToe}/>}
    {activeTab === "sudoku" && <SudokuLogs rows={data.sudoku}/>}
    <Pagination activeTab={activeTab} page={data.page} pageSize={data.pageSize} total={activeTab === "pong" ? data.totals.pong : activeTab === "jogo-da-velha" ? data.totals.ticTacToe : data.totals.sudoku}/>
  </>;
}

function PongLogs({ rows }: { rows: MinigameLogsData["pong"] }) {
  return <LogGrid empty="Nenhuma sala de Pong registrada.">{rows.map((row) => <LogCard key={row.id} title={`Sala ${row.code}`} subtitle={`${date(row.createdAt)} · ${statusLabel(row.status)}`}>
    <Players first={row.owner} second={row.guest}/><MetricGrid items={[["Placar", `${row.ownerScore} × ${row.guestScore}`], ["Aposta", `${row.wager} DC cada`], ["Pote custodiado", `${row.ownerStake + row.guestStake} DC`], ["Vencedor", row.winner], ["Prêmio", `${row.winnerPayout} DC`], ["Imposto", `${row.taxAmount} DC`]]}/>
    <Footer started={row.startedAt} finished={row.finishedAt}/>
  </LogCard>)}</LogGrid>;
}

function TicTacToeLogs({ rows }: { rows: MinigameLogsData["ticTacToe"] }) {
  return <LogGrid empty="Nenhuma rodada multiplayer de Jogo da Velha registrada.">{rows.map((row) => <LogCard key={row.id} title={`Sala ${row.code} · Rodada ${row.round}`} subtitle={row.isDraw ? "Empate" : `Vitória de ${row.winner}`}>
    <Players first={row.owner} second={row.guest}/><MetricGrid items={[["Tabuleiro final", row.board.replaceAll("-", "·")], ["Aposta", `${row.wager} DC cada`], ["Pote", `${row.wager * 2} DC`], ["Prêmio", `${row.winnerPayout} DC`], ["Imposto", `${row.taxAmount} DC`]]}/>
    <Footer started={row.startedAt} finished={row.finishedAt}/>
  </LogCard>)}</LogGrid>;
}

function SudokuLogs({ rows }: { rows: MinigameLogsData["sudoku"] }) {
  return <div className="mt-5"><div className="mb-4 rounded-2xl border border-cyan-300/15 bg-cyan-300/5 p-4 text-xs leading-relaxed text-slate-400"><strong className="text-cyan-200">Como interpretar:</strong> o percentual combina duração, cadência, movimentos muito rápidos e sequências de preenchimento. É um indício pedagógico, não prova de uso de IA e não produz punição automática.</div><LogGrid empty="Nenhuma partida de Sudoku registrada.">{rows.map((row) => <LogCard key={row.id} title={`${row.student} · ${row.difficultyLabel}`} subtitle={`${date(row.startedAt)} · ${statusLabel(row.status)}`}>
    <div className="grid gap-3 sm:grid-cols-[150px_1fr]"><Score score={row.humanPlayScore}/><MetricGrid items={[["Duração", duration(row.elapsedSeconds)], ["Números inseridos", String(row.valueActions)], ["Mediana entre jogadas", row.medianGapSeconds === null ? "—" : `${row.medianGapSeconds}s`], ["Jogadas abaixo de 5s", row.rapidMovePercent === null ? "—" : `${row.rapidMovePercent}%`], ["Maior sequência rápida", row.longestRapidSequence === null ? "—" : `${row.longestRapidSequence} números`], ["Espera inicial", row.firstActionDelaySeconds === null ? "—" : `${row.firstActionDelaySeconds}s`], ["Erros / dicas", `${row.mistakes} / ${row.hintsUsed}`], ["XP recebido", `${row.xpReward} XP`], ["Ranking", row.eligibleForRanking ? "Elegível" : "Inelegível"]]}/></div>
    {row.solutionTranscriptionPattern && <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs text-amber-100"><Bot className="mt-0.5 shrink-0" size={16}/>Padrão compatível com espera inicial seguida de transcrição rápida de uma solução pronta.</p>}
    <Footer started={row.startedAt} finished={row.completedAt}/>
  </LogCard>)}</LogGrid></div>;
}

function Score({ score }: { score: number | null }) { const tone = score === null ? "text-slate-500" : score >= 75 ? "text-emerald-300" : score >= 50 ? "text-cyan-300" : score >= 25 ? "text-amber-300" : "text-rose-300"; return <div className="grid min-h-32 place-items-center rounded-2xl border border-white/8 bg-slate-950/30 p-4 text-center"><CircleGauge className={tone} size={28}/><div><strong className={`font-display text-3xl ${tone}`}>{score === null ? "—" : `${score}%`}</strong><p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">consistência humana</p></div></div>; }
function Players({ first, second }: { first: string; second: string }) { return <div className="mb-4 flex items-center gap-3 rounded-xl bg-slate-950/30 p-3 text-xs"><UsersRound className="shrink-0 text-blue-300" size={18}/><span className="font-bold text-slate-200">{first}</span><span className="text-slate-600">×</span><span className="font-bold text-slate-200">{second}</span></div>; }
function MetricGrid({ items }: { items: [string, string][] }) { return <dl className="grid flex-1 grid-cols-2 gap-2 text-xs">{items.map(([label, value]) => <div key={label} className="rounded-xl bg-white/[.035] p-3"><dt className="text-slate-500">{label}</dt><dd className="mt-1 break-words font-bold text-slate-200">{value}</dd></div>)}</dl>; }
function Footer({ started, finished }: { started: string | null; finished: string | null }) { return <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-800 pt-3 text-[11px] text-slate-500"><span className="flex items-center gap-1.5"><Timer size={13}/>Início: {date(started)}</span><span className="flex items-center gap-1.5"><Trophy size={13}/>Fim: {date(finished)}</span></div>; }
function LogGrid({ children, empty }: { children: React.ReactNode; empty: string }) { const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children); return hasChildren ? <section className="mt-5 grid gap-4 xl:grid-cols-2">{children}</section> : <div className="mt-5 rounded-2xl border border-dashed border-slate-700 p-10 text-center text-sm text-slate-500">{empty}</div>; }
function LogCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) { return <article className="rounded-2xl border border-slate-800 bg-[#0d1726] p-5 shadow-xl shadow-black/10"><div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="font-display font-bold text-slate-100">{title}</h2><p className="mt-1 text-xs text-slate-500">{subtitle}</p></div><ShieldCheck className="shrink-0 text-emerald-300" size={19}/></div>{children}</article>; }
function statusLabel(status: string) { return ({ WAITING: "Aguardando", ACTIVE: "Em andamento", FINISHED: "Finalizada", CANCELLED: "Cancelada", COMPLETED: "Concluída", FAILED: "Encerrada por erros" } as Record<string, string>)[status] ?? status; }
function Pagination({ activeTab, page, pageSize, total }: { activeTab: Tab; page: number; pageSize: number; total: number }) { const totalPages = Math.max(1, Math.ceil(total / pageSize)); if (totalPages <= 1) return null; return <nav aria-label="Paginação dos logs" className="mt-6 flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/40 p-3 text-sm"><Link aria-disabled={page <= 1} href={`/professor/logs/minigames?jogo=${activeTab}&pagina=${Math.max(1, page - 1)}`} className={`button-secondary py-2 ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}>Anterior</Link><span className="text-xs text-slate-400">Página <strong className="text-slate-200">{page}</strong> de {totalPages} · {total} registros</span><Link aria-disabled={page >= totalPages} href={`/professor/logs/minigames?jogo=${activeTab}&pagina=${Math.min(totalPages, page + 1)}`} className={`button-secondary py-2 ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`}>Próxima</Link></nav>; }
