import Link from "next/link";
import { ArrowLeft, Bot, CircuitBoard, Gamepad2, Swords, Wrench } from "lucide-react";
import { Brand } from "@/components/brand";
import { requireStudent } from "@/lib/authorization";

export default async function MiniGamesPage() {
  await requireStudent();
  return <main className="mesh mobile-safe min-h-screen"><div className="mx-auto max-w-6xl px-5 pb-24 sm:px-8">
    <header className="flex h-20 items-center justify-between border-b border-white/7"><Brand context="Mini games"/><Link href="/aluno" className="button-secondary"><ArrowLeft size={17}/>Área do aluno</Link></header>
    <section className="py-9"><p className="eyebrow">Laboratório de diversão</p><h1 className="mt-3 font-display text-4xl font-bold">Mini games <span className="text-cyan-300">Maker</span></h1><p className="mt-3 max-w-2xl text-slate-300">Jogos temáticos de robótica, ligados à sua conta, com regras transparentes e partidas persistentes.</p></section>
    <div className="grid gap-6 lg:grid-cols-2">
      <Link href="/aluno/minigames/ludo" className="group relative overflow-hidden rounded-3xl border border-cyan-300/25 bg-gradient-to-br from-cyan-400/15 via-blue-500/10 to-fuchsia-500/15 p-7 transition hover:-translate-y-1 hover:border-cyan-300/50">
        <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-cyan-400/10 blur-3xl"/><div className="relative"><div className="flex items-center justify-between"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-cyan-300/15 text-cyan-200"><CircuitBoard size={30}/></span><span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-bold text-emerald-200">Disponível</span></div><p className="eyebrow mt-7">Estratégia por turnos</p><h2 className="mt-2 font-display text-3xl font-bold">Ludo Maker</h2><p className="mt-3 text-sm leading-relaxed text-slate-300">Comande quatro robôs, dispute circuitos com até quatro alunos ou desafie a IA do professor.</p><div className="mt-6 flex flex-wrap gap-3 text-xs text-slate-300"><span className="flex items-center gap-1 rounded-full bg-white/5 px-3 py-2"><Swords size={14}/>Apostas em DC</span><span className="flex items-center gap-1 rounded-full bg-white/5 px-3 py-2"><Bot size={14}/>IA difícil</span><span className="flex items-center gap-1 rounded-full bg-white/5 px-3 py-2"><Gamepad2 size={14}/>Tempo real</span></div><span className="button-primary mt-7 inline-flex">Abrir Ludo Maker</span></div>
      </Link>
      <section className="grid min-h-72 place-items-center rounded-3xl border border-dashed border-slate-700 bg-slate-900/30 p-7 text-center"><div><Wrench className="mx-auto text-slate-500" size={36}/><h2 className="mt-4 font-display text-xl font-bold text-slate-300">Próximo projeto</h2><p className="mt-2 text-sm text-slate-500">Novos desafios Maker poderão aparecer aqui.</p></div></section>
    </div>
  </div></main>;
}
