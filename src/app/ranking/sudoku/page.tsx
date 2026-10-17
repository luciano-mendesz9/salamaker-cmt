import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Brain, Clock3, Crown, Medal, Trophy } from "lucide-react";
import { Brand } from "@/components/brand";
import { EmptyState } from "@/components/empty-state";
import { getProfileAvatar } from "@/lib/profile-avatars";
import { SUDOKU_DIFFICULTIES, type SudokuDifficultyKey } from "@/lib/sudoku-rules";
import { getSudokuRanking } from "@/lib/sudoku-service";

const difficulties = Object.keys(SUDOKU_DIFFICULTIES) as SudokuDifficultyKey[];
const classLabels: Record<string, string> = { GRADE_6_A: "6º Ano A", GRADE_6_B: "6º Ano B", GRADE_6_C: "6º Ano C", GRADE_7_A: "7º Ano A", GRADE_7_B: "7º Ano B", GRADE_7_C: "7º Ano C" };
export const metadata = { title: "Ranking Sudoku" };

export default async function SudokuRankingPage({ searchParams }: { searchParams: Promise<{ dificuldade?: string }> }) {
  const requested = (await searchParams).dificuldade?.toUpperCase() as SudokuDifficultyKey | undefined;
  const difficulty = requested && difficulties.includes(requested) ? requested : "EASY";
  const ranking = await getSudokuRanking(difficulty);
  return <main className="mesh min-h-screen"><div className="mx-auto max-w-5xl px-4 pb-20 sm:px-8"><header className="flex h-20 items-center justify-between border-b border-white/7"><Brand context="Ranking Sudoku"/><Link href="/login" className="text-sm font-bold text-blue-300">Acessar conta</Link></header>
    <section className="py-9"><div className="flex flex-wrap items-start justify-between gap-4"><div><Link href="/ranking" className="inline-flex items-center gap-2 text-sm text-slate-400"><ArrowLeft size={16}/>Ranking geral</Link><p className="eyebrow mt-7 flex items-center gap-2"><Brain size={16}/>Mestres da lógica</p><h1 className="mt-3 font-display text-4xl font-black">Menores tempos no Sudoku</h1><p className="mt-2 text-sm text-slate-400">Apenas partidas concluídas sem dicas e sem compra de erros extras.</p></div><Link href="/aluno/minigames/sudoku" className="button-primary">Jogar Sudoku</Link></div>
    <nav className="mt-7 flex gap-2 overflow-x-auto pb-2" aria-label="Dificuldades">{difficulties.map((key) => <Link key={key} href={`/ranking/sudoku?dificuldade=${key.toLowerCase()}`} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${difficulty === key ? "bg-amber-300 text-slate-950" : "bg-white/5 text-slate-300 hover:bg-white/10"}`}>{SUDOKU_DIFFICULTIES[key].label}</Link>)}</nav>
    <section className="mt-6 overflow-hidden rounded-3xl border border-amber-300/20 bg-gradient-to-br from-[#231b09] to-[#101d30] p-5 sm:p-7"><div className="flex items-center justify-between"><div className="flex items-center gap-2 text-amber-300"><Crown size={20}/><h2 className="font-display text-xl font-black">Top {SUDOKU_DIFFICULTIES[difficulty].label}</h2></div><span className="rounded-full bg-white/5 px-3 py-1.5 text-xs text-slate-400">{ranking.length} classificados</span></div>
    {ranking.length === 0 ? <div className="mt-6"><EmptyState icon={Trophy} title="O primeiro lugar está livre" description="Conclua uma partida válida para inaugurar este ranking."/></div> : <div className="mt-6 space-y-3">{ranking.map((entry, index) => <article key={entry.id} className={`flex items-center gap-3 rounded-2xl border p-3 sm:gap-5 sm:p-4 ${index === 0 ? "border-amber-300/30 bg-amber-300/10" : "border-white/5 bg-white/[.03]"}`}><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl font-display text-lg font-black ${index === 0 ? "bg-amber-300 text-slate-950" : "bg-white/5 text-slate-300"}`}>{index + 1}</span><Image src={getProfileAvatar(entry.student.profileAvatar)} alt={`Avatar de ${entry.student.firstName}`} className="h-11 w-11 rounded-xl object-cover"/><div className="min-w-0 flex-1"><p className="truncate font-bold">{entry.student.firstName} {entry.student.lastName}</p><p className="text-xs text-slate-500">{entry.student.originSchoolClass ? classLabels[entry.student.originSchoolClass] : "Turma não informada"}</p></div><div className="text-right"><p className="flex items-center gap-1 font-mono text-lg font-black text-amber-200"><Clock3 size={16}/>{formatTime(entry.elapsedSeconds ?? 0)}</p>{index < 3 && <p className="mt-1 flex items-center justify-end gap-1 text-[10px] uppercase tracking-wider text-amber-300"><Medal size={11}/>Pódio</p>}</div></article>)}</div>}</section>
    </section>
  </div></main>;
}
function formatTime(seconds: number) { return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`; }
