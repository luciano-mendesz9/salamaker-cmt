"use client";

import Link from "next/link";
import { Bell, ClipboardList, Gamepad2, Home } from "lucide-react";
import { usePathname } from "next/navigation";

export function StudentMobileNav() {
  const pathname = usePathname();
  if (/^\/aluno\/minigames\/ludo\/[^/]+$/.test(pathname)) return null;

  return (
    <nav aria-label="Navegação do aluno" className="fixed inset-x-0 bottom-0 z-40 flex h-[68px] items-center justify-around border-t border-slate-800 bg-[#0d1726]/95 backdrop-blur sm:hidden">
      <Link href="/aluno" className="focus-ring flex flex-col items-center gap-1 text-xs text-slate-300"><Home size={20}/>Início</Link>
      <Link href="/aluno/atividades" className="focus-ring flex flex-col items-center gap-1 text-xs text-slate-300"><ClipboardList size={20}/>Atividades</Link>
      <Link href="/aluno/minigames" className="focus-ring flex flex-col items-center gap-1 text-xs text-cyan-300"><Gamepad2 size={20}/>Jogos</Link>
      <Link href="/aluno/notificacoes" className="focus-ring flex flex-col items-center gap-1 text-xs text-slate-300"><Bell size={20}/>Avisos</Link>
    </nav>
  );
}
