import Link from "next/link";
import { Activity, Bell, BookOpen, ClipboardList, ExternalLink, Gauge, Palette, ScrollText, Settings2, Trophy, UsersRound } from "lucide-react";
import { Brand } from "./brand";
import { LogoutButton } from "./logout-button";

const links = [
  ["/professor", "Visão geral", Gauge],
  ["/professor/aulas", "Histórico de aulas", BookOpen],
  ["/professor/atividades", "Atividades", ClipboardList],
  ["/professor/notificacoes", "Notificações", Bell],
  ["/professor/comportamento", "Comportamento", Activity],
  ["/professor/logs", "Logs do sistema", ScrollText],
  ["/professor/moderacao", "Moderação e tema", Palette],
] as const;

export function ProfessorShell({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="mobile-safe min-h-screen bg-[#0b1421]">
    <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-800 bg-[#0d1726] p-5 lg:flex lg:flex-col">
      <Brand context="Professor"/>
      <p className="mt-9 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-slate-600">Sala Maker</p>
      <nav className="mt-3 space-y-1">{links.map(([href,label,Icon])=><Link key={href} href={href} className="focus-ring flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-400 transition hover:bg-blue-400/10 hover:text-blue-200"><Icon size={18}/>{label}</Link>)}</nav>
      <Link href="/ranking" target="_blank" rel="noopener noreferrer" className="focus-ring mt-4 flex items-center gap-3 rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-3 text-sm font-bold text-amber-200 transition hover:border-amber-300/40 hover:bg-amber-300/15">
        <Trophy size={18}/><span>Ver Ranking</span><ExternalLink className="ml-auto" size={15} aria-hidden="true"/>
      </Link>
      <div className="mt-auto rounded-2xl border border-blue-400/15 bg-blue-400/5 p-4"><UsersRound className="text-blue-300" size={20}/><p className="mt-3 text-sm font-bold">Uma turma de Robótica.</p><p className="mt-1 text-xs leading-relaxed text-slate-400">Alunos do 6º e 7º ano aprendendo juntos.</p></div>
    </aside>
    <main className="lg:ml-64"><header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-800 bg-[#0b1421]/90 px-5 backdrop-blur-xl sm:px-8"><div><p className="text-xs text-slate-500">Painel do professor</p><h1 className="font-display font-bold">{title}</h1></div><div className="flex items-center gap-3"><span className="hidden items-center gap-2 rounded-full border border-slate-800 px-3 py-2 text-xs text-slate-400 sm:flex"><i className="h-2 w-2 rounded-full bg-emerald-400"/>Ambiente ativo</span><LogoutButton/></div></header><div className="mx-auto max-w-[1500px] p-5 sm:p-8">{children}</div></main>
    <nav aria-label="Navegação do professor" className="fixed inset-x-0 bottom-0 z-30 flex h-[72px] items-center justify-around border-t border-slate-800 bg-[#0d1726]/95 backdrop-blur lg:hidden">
      <Link href="/professor" aria-label="Visão geral" className="focus-ring text-slate-400"><Gauge/></Link>
      <Link href="/professor/aulas" aria-label="Aulas" className="focus-ring text-slate-400"><BookOpen/></Link>
      <Link href="/professor/atividades" aria-label="Atividades" className="focus-ring text-blue-300"><ClipboardList/></Link>
      <Link href="/professor/notificacoes" aria-label="Notificações" className="focus-ring text-slate-400"><Bell/></Link>
      <Link href="/professor/comportamento" aria-label="Comportamento" className="focus-ring text-slate-400"><Activity/></Link>
      <Link href="/professor/moderacao" aria-label="Configurações" className="focus-ring text-slate-400"><Settings2/></Link>
    </nav>
  </div>;
}
