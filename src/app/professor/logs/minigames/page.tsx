import Link from "next/link";
import { ArrowLeft, Gamepad2 } from "lucide-react";
import { MinigameLogs } from "@/components/minigame-logs";
import { ProfessorShell } from "@/components/professor-shell";
import { getMinigameLogs } from "@/lib/minigame-logs";

type Tab = "pong" | "jogo-da-velha" | "sudoku";
export default async function MinigameLogsPage({ searchParams }: { searchParams: Promise<{ jogo?: string; pagina?: string }> }) {
  const params = await searchParams;
  const { jogo } = params;
  const activeTab: Tab = jogo === "jogo-da-velha" || jogo === "sudoku" ? jogo : "pong";
  const requestedPage = Number(params.pagina);
  const data = await getMinigameLogs(Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1);
  return <ProfessorShell title="Logs de minigames"><Link href="/professor/logs" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={16}/>Logs do sistema</Link><p className="eyebrow mt-6 flex items-center gap-2"><Gamepad2 size={16}/>Auditoria de partidas</p><h2 className="mt-3 font-display text-3xl font-bold">Histórico dos minigames</h2><p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">Resultados persistidos pelo servidor. Use o índice do Sudoku como apoio pedagógico: ele descreve o padrão da partida, não determina sozinho se houve ajuda externa.</p><MinigameLogs data={data} activeTab={activeTab}/></ProfessorShell>;
}
