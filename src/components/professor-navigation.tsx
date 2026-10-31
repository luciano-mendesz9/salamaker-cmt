"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Activity, Bell, BookOpen, ClipboardList, Coins, ExternalLink, Gamepad2, Gauge, Images, KeyRound, Menu, Orbit, Palette, ScrollText, ShoppingBasket, Trophy, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import styles from "./professor-navigation.module.css";

type NavEntry = { href: string; label: string; icon: LucideIcon };

const overview: NavEntry[] = [
  { href: "/professor", label: "Dashboard", icon: Gauge },
  { href: "/professor/atividades", label: "Atividades", icon: ClipboardList },
  { href: "/professor/aulas", label: "Histórico de aulas", icon: BookOpen },
  { href: "/professor/notificacoes", label: "Notificações", icon: Bell },
];

const management: NavEntry[] = [
  { href: "/professor/comportamento", label: "Comportamento", icon: Activity },
  { href: "/professor/logs", label: "Logs do sistema", icon: ScrollText },
  { href: "/professor/logs/minigames", label: "Logs de minigames", icon: Gamepad2 },
  { href: "/professor/moderacao", label: "Moderação e tema", icon: Palette },
  { href: "/professor/tesouraria", label: "Tesouraria Dev-Coin", icon: Coins },
  { href: "/professor/figurinhas/catalogo", label: "Catálogo de figurinhas", icon: Images },
  { href: "/professor/figurinhas/compras", label: "Comprar coleções", icon: ShoppingBasket },
  { href: "/professor/conta", label: "Minha conta", icon: KeyRound },
];

function isRouteActive(pathname: string, href: string) {
  return pathname === href || (href !== "/professor" && pathname.startsWith(`${href}/`));
}

function SidebarContent({ pathname, showLocalAssets, onNavigate, mobile = false }: { pathname: string; showLocalAssets: boolean; onNavigate?: () => void; mobile?: boolean }) {
  const groups = [
    { title: "Área de ensino", items: overview },
    { title: "Gestão e acompanhamento", items: [...management, ...(showLocalAssets ? [{ href: "/professor/midias", label: "Mídias locais", icon: Images }] : [])] },
  ];
  const activeHref = groups.flatMap(group => group.items).filter(item => isRouteActive(pathname, item.href)).sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return <>
    <div className={styles.sidebarHeader}>
      <Link href="/professor" onClick={onNavigate} className={styles.brand} aria-label="Sala Maker, ir ao dashboard">
        <span className={styles.brandIcon}><Orbit size={26} strokeWidth={1.9}/></span>
        <span><strong>SALA MAKER<span className={styles.brandDot}>.</span></strong><small>CMT · PAINEL DO PROFESSOR</small></span>
      </Link>
      {mobile && <button type="button" onClick={onNavigate} className={styles.closeButton} aria-label="Fechar menu"><X size={21}/></button>}
    </div>
    <div className={styles.sidebarScroll}>
      <div className={styles.welcomeCard}><span className={styles.welcomeMarker}>ESPAÇO DE ENSINO</span><p>Seu trabalho,<br/><strong>em foco.</strong></p><span>Acesse suas ferramentas em um só lugar.</span></div>
      {groups.map(group => <div key={group.title} className={styles.navGroup}>
        <p className={styles.groupTitle}>{group.title}</p>
        <nav aria-label={group.title} className={styles.navList}>
          {group.items.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={onNavigate} aria-current={activeHref === href ? "page" : undefined} className={`${styles.navLink} ${activeHref === href ? styles.navLinkActive : ""}`}><Icon size={19} strokeWidth={1.9}/><span>{label}</span>{activeHref === href && <span className={styles.activeMarker} aria-hidden="true"/>}</Link>)}
        </nav>
      </div>)}
      <div className={styles.sidebarBottom}>
        <Link href="/ranking" target="_blank" rel="noopener noreferrer" onClick={onNavigate} className={styles.rankingLink}><span className={styles.rankingIcon}><Trophy size={19}/></span><span><strong>Ver ranking</strong><small>Acompanhe a turma</small></span><ExternalLink size={16} className={styles.externalIcon}/></Link>
        <div className={styles.schoolTag}><span className={styles.schoolTagIcon}><Orbit size={16}/></span><span>Sala Maker CMT</span></div>
      </div>
    </div>
  </>;
}

export function ProfessorNavigation({ showLocalAssets }: { showLocalAssets: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const drawer = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const menuTrigger = menuButton.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = requestAnimationFrame(() => drawer.current?.querySelector<HTMLButtonElement>('button[aria-label="Fechar menu"]')?.focus());
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") { setOpen(false); return; }
      if (event.key !== "Tab") return;
      const focusable = drawer.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => { cancelAnimationFrame(focusFrame); window.removeEventListener("keydown", handleKeyDown); document.body.style.overflow = previousOverflow; menuTrigger?.focus(); };
  }, [open]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (desktop.matches) setOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  const tabs: NavEntry[] = [
    { href: "/professor", label: "Dashboard", icon: Gauge },
    { href: "/professor/atividades", label: "Atividades", icon: ClipboardList },
    { href: "/professor/logs", label: "Logs", icon: ScrollText },
  ];

  return <>
    <aside className={styles.desktopSidebar} aria-label="Menu do professor"><SidebarContent pathname={pathname} showLocalAssets={showLocalAssets}/></aside>
    {open && <div className={styles.drawerLayer}>
      <button type="button" className={styles.backdrop} onClick={() => setOpen(false)} aria-label="Fechar menu lateral"/>
      <aside id="professor-mobile-menu" ref={drawer} className={styles.mobileDrawer} role="dialog" aria-modal="true" aria-label="Menu completo do professor"><SidebarContent pathname={pathname} showLocalAssets={showLocalAssets} onNavigate={() => setOpen(false)} mobile/></aside>
    </div>}
    <nav className={styles.mobileTabbar} aria-label="Acesso rápido do professor">
      <button ref={menuButton} type="button" className={`${styles.tab} ${open ? styles.tabActive : ""}`} onClick={() => setOpen(true)} aria-label="Abrir menu completo" aria-controls="professor-mobile-menu" aria-expanded={open}><Menu size={22}/><span>Menu</span></button>
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = isRouteActive(pathname, href);
        return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`${styles.tab} ${active ? styles.tabActive : ""}`}><Icon size={22}/><span>{label}</span></Link>;
      })}
    </nav>
  </>;
}
