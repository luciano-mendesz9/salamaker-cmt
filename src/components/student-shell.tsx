"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  BookOpen,
  Boxes,
  ExternalLink,
  Gamepad2,
  Home,
  Trophy,
  UserRound,
  WalletCards,
} from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import { getProfileAvatar, type ProfileAvatarKey } from "@/lib/profile-avatars";

type Props = {
  children: React.ReactNode;
  student: {
    firstName: string;
    lastName: string;
    profileAvatar: string;
    classLabel: string;
  };
  unread: number;
};

const navItems = [
  { href: "/aluno", label: "Visão geral", icon: Home, exact: true },
  { href: "/aluno/atividades", label: "Minhas atividades", icon: BookOpen },
  { href: "/aluno/album", label: "Álbum e carteira", icon: WalletCards },
  { href: "/aluno/minigames", label: "Minigames", icon: Gamepad2 },
  { href: "/ranking", label: "Ranking", icon: Trophy },
  { href: "/aluno/notificacoes", label: "Notificações", icon: Bell },
  { href: "/aluno/perfil", label: "Meu perfil", icon: UserRound },
] as const;

const titles: Record<string, string> = {
  "/aluno": "Visão geral",
  "/aluno/atividades": "Minhas atividades",
  "/aluno/album": "Álbum de Figurinhas",
  "/aluno/minigames": "Minigames",
  "/aluno/notificacoes": "Notificações",
  "/aluno/perfil": "Meu perfil",
};

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function StudentShell({ children, student, unread }: Props) {
  const pathname = usePathname();
  const immersive = pathname === "/aluno/trocar-senha" || /^\/aluno\/minigames\/(?:ludo|pong|jogo-da-velha|sudoku)\/[^/]+$/.test(pathname);
  if (immersive) return <>{children}</>;

  const currentTitle = Object.entries(titles)
    .sort(([a], [b]) => b.length - a.length)
    .find(([path]) => pathname === path || pathname.startsWith(`${path}/`))?.[1] ?? "Espaço do estudante";
  const avatarKey = student.profileAvatar as ProfileAvatarKey;

  return (
    <div className="student-shell min-h-screen">
      <a href="#student-main" className="student-skip-link">Pular para o conteúdo</a>
      <aside className="student-sidebar" aria-label="Menu principal">
        <Link href="/" className="focus-ring flex items-center gap-3 rounded-xl">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--accent)] text-white shadow-lg shadow-black/20"><Boxes size={24}/></span>
          <span><strong className="block text-base tracking-tight">SALA MAKER<span className="text-[var(--accent-soft)]">.</span></strong><small className="mt-1 block text-xs font-bold uppercase tracking-[.16em] text-slate-500">CMT · Estudante</small></span>
        </Link>

        <p className="student-nav-label">Seu espaço</p>
        <nav className="space-y-1.5">
          {navItems.slice(0, 3).map(item => <StudentNavLink key={item.href} {...item} pathname={pathname} unread={unread}/>) }
        </nav>
        <p className="student-nav-label">Explore e crie</p>
        <nav className="space-y-1.5">
          {navItems.slice(3).map(item => <StudentNavLink key={item.href} {...item} pathname={pathname} unread={unread}/>) }
          <a href="https://www.tinkercad.com/joinclass/ABJNGWPUT" target="_blank" rel="noreferrer" className="student-nav-link">
            <Boxes size={18}/>Tinkercad<ExternalLink className="ml-auto" size={14}/>
          </a>
        </nav>

        <div className="mt-auto pt-8">
          <div className="mb-4 rounded-2xl border border-[color-mix(in_srgb,var(--accent)_18%,transparent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] p-4">
            <p className="flex items-center gap-2 text-xs font-bold"><span className="h-2 w-2 rounded-full bg-emerald-400"/>Continue construindo.</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">Toda grande ideia começa com uma pequena descoberta.</p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-white/6 bg-white/3 p-2">
            <Link href="/aluno/perfil" className="focus-ring flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1" aria-label="Abrir meu perfil"><span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl"><Image src={getProfileAvatar(avatarKey)} alt="" fill sizes="40px" className="object-cover"/></span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{student.firstName} {student.lastName}</strong><small className="mt-1 block truncate text-xs text-slate-500">{student.classLabel}</small></span></Link>
            <LogoutButton/>
          </div>
        </div>
      </aside>

      <div className="min-w-0 md:ml-[248px]">
        <header className="student-topbar">
          <Link href="/" className="focus-ring flex items-center gap-2.5 rounded-xl md:hidden"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--accent)] text-white"><Boxes size={20}/></span><span className="text-sm font-extrabold">SALA MAKER<span className="text-[var(--accent-soft)]">.</span><small className="block text-xs uppercase tracking-[.1em] text-slate-500">CMT · Estudante</small></span></Link>
          <div className="hidden md:block"><p className="text-xs text-slate-500">Espaço do estudante</p><p className="mt-1 text-sm font-bold">{currentTitle}</p></div>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/aluno/notificacoes" className="student-icon-button relative" aria-label={`Notificações${unread ? `, ${unread} não lidas` : ""}`}><Bell size={18}/>{unread > 0 && <span className="student-unread-badge">{unread > 99 ? "99+" : unread}</span>}</Link>
            <Link href="/aluno/perfil" className="focus-ring relative block h-10 w-10 overflow-hidden rounded-xl" aria-label="Abrir meu perfil"><Image src={getProfileAvatar(avatarKey)} alt={`Foto de ${student.firstName}`} fill sizes="40px" className="object-cover"/></Link>
            <LogoutButton/>
          </div>
        </header>
        <div id="student-main" tabIndex={-1} className="student-shell-content outline-none">{children}</div>
        <footer className="student-footer"><span>Sala Maker CMT · Um espaço para transformar ideias.</span><span>Aprenda, crie e compartilhe.</span></footer>
      </div>

      <nav className="student-bottom-nav" aria-label="Menu principal para celular">
        {navItems.filter(item => ["/aluno", "/aluno/atividades", "/aluno/minigames", "/aluno/album", "/aluno/notificacoes"].includes(item.href)).map(item => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href, "exact" in item && item.exact);
          return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`student-bottom-link ${active ? "is-active" : ""}`}><span className="relative"><Icon size={20}/>{item.href === "/aluno/notificacoes" && unread > 0 && <span className="absolute -right-2 -top-1 h-2 w-2 rounded-full bg-rose-400"/>}</span>{item.href === "/aluno" ? "Início" : item.href === "/aluno/album" ? "Carteira" : item.label.split(" ").at(-1)}</Link>;
        })}
      </nav>
    </div>
  );
}

function StudentNavLink({ href, label, icon: Icon, exact, pathname, unread }: { href: string; label: string; icon: typeof Home; exact?: boolean; pathname: string; unread: number }) {
  const active = isActive(pathname, href, exact);
  return <Link href={href} aria-current={active ? "page" : undefined} className={`student-nav-link ${active ? "is-active" : ""}`}><Icon size={18}/>{label}{href === "/aluno/notificacoes" && unread > 0 && <span className="ml-auto rounded-lg bg-[color-mix(in_srgb,var(--accent)_17%,transparent)] px-2 py-0.5 text-[10px] font-black text-[var(--accent-soft)]">{unread}</span>}</Link>;
}
