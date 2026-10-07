"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Coins, Gamepad2, Hash, Laptop, ShieldAlert, Trophy, UsersRound, Zap } from "lucide-react";
import { toast } from "sonner";
import { Brand } from "@/components/brand";
import { LogoutButton } from "@/components/logout-button";
import { PONG_DAILY_ROOM_LIMIT, PONG_ROOM_FEE, pongSettlement } from "@/lib/pong-rules";

type Lobby = {
  gamesEnabled: boolean;
  currentRoom: { id: string; code: string; status: string } | null;
  pendingRequest: { id: string; expiresAt: string; room: { id: string; code: string; wager: number; owner: { firstName: string; lastName: string } } } | null;
  createdToday: number;
  remainingCreations: number;
  devCoins: number;
  xp: number;
};

export function PongLobby({ initial, studentName }: { initial: Lobby; studentName: string }) {
  const router = useRouter();
  const [lobby, setLobby] = useState(initial);
  const [wager, setWager] = useState(10);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const settlement = pongSettlement(wager);

  useEffect(() => {
    if (!lobby.pendingRequest) return;
    const timer = window.setInterval(async () => {
      const response = await fetch("/api/student/minigames/pong/rooms", { cache: "no-store" });
      if (!response.ok) return;
      const next = await response.json() as Lobby;
      setLobby(next);
      if (next.currentRoom) router.push(`/aluno/minigames/pong/${next.currentRoom.id}`);
    }, 2_000);
    return () => window.clearInterval(timer);
  }, [lobby.pendingRequest, router]);

  async function createRoom() {
    setBusy("create");
    const response = await fetch("/api/student/minigames/pong/rooms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wager, requestId: crypto.randomUUID() }),
    });
    const data = await response.json();
    setBusy(null);
    if (!response.ok) return toast.error(data.message);
    router.push(`/aluno/minigames/pong/${data.room.id}`);
  }

  async function requestJoin() {
    setBusy("join");
    const response = await fetch("/api/student/minigames/pong/rooms/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, requestId: crypto.randomUUID() }),
    });
    const data = await response.json();
    setBusy(null);
    if (!response.ok) return toast.error(data.message);
    toast.success("Pedido enviado ao dono da sala.");
    setLobby((current) => ({ ...current, pendingRequest: { id: data.requestId, expiresAt: data.expiresAt, room: { id: data.roomId, code, wager: 0, owner: { firstName: "Dono", lastName: "da sala" } } } }));
  }

  return <main className="mesh min-h-screen">
    <div className="mx-auto max-w-6xl px-5 pb-16 sm:px-8">
      <header className="flex h-20 items-center justify-between border-b border-white/7"><Brand context="Minigames"/><div className="flex items-center gap-2"><Link href="/aluno" className="button-secondary py-2 text-sm">Voltar</Link><LogoutButton/></div></header>
      <section className="md:hidden"><div className="glass mt-10 rounded-3xl p-8 text-center"><Laptop className="mx-auto text-cyan-300" size={42}/><h1 className="mt-5 font-display text-2xl font-bold">Pong disponível no computador</h1><p className="mt-3 text-sm leading-relaxed text-slate-400">Este minigame usa teclado e tela ampla. Abra esta página em um computador para criar ou entrar em uma partida.</p></div></section>
      <div className="hidden md:block">
        <section className="mt-9 overflow-hidden rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-[#071a24] via-[#071018] to-[#170b21] p-8">
          <div className="flex items-start justify-between gap-6"><div><p className="eyebrow flex items-center gap-2"><Gamepad2 size={16}/>Sala Maker Arcade</p><h1 className="mt-3 font-display text-4xl font-bold">Pong multiplayer</h1><p className="mt-3 max-w-2xl text-slate-300">Olá, {studentName}. Crie uma sala, compartilhe o código de 6 dígitos e dispute uma partida até 10 pontos.</p></div><div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-5 py-4 text-right"><p className="text-xs text-amber-100/70">Seu saldo</p><p className="mt-1 text-2xl font-black text-amber-200">{lobby.devCoins} DC</p></div></div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-4">
          <Rule icon={Coins} title="Taxa + aposta" text="Criar custa 50 DC. A aposta de cada jogador, entre 10 e 100 DC, só é debitada quando a partida começa."/>
          <Rule icon={Trophy} title="Prêmio e imposto" text="O vencedor recebe 70% das duas apostas somadas. Os 30% restantes são o imposto da partida."/>
          <Rule icon={Zap} title="Derrota" text="O perdedor perde os Dev-Coins apostados e 50 XP, inclusive em desistência ou derrota por desconexão."/>
          <Rule icon={ShieldAlert} title="Desconexão" text="Após 3 minutos desconectado, o jogador perde e quem permaneceu na sala vence."/>
        </section>

        {lobby.currentRoom && <section className="glass mt-6 flex items-center justify-between rounded-2xl border border-cyan-300/20 p-5"><div><p className="font-bold">Você já está na sala {lobby.currentRoom.code}</p><p className="text-sm text-slate-400">Status: {lobby.currentRoom.status === "ACTIVE" ? "partida em andamento" : "aguardando"}</p></div><Link href={`/aluno/minigames/pong/${lobby.currentRoom.id}`} className="button-primary">Abrir sala</Link></section>}

        {lobby.pendingRequest ? <section className="glass mt-6 rounded-2xl border border-fuchsia-300/20 p-6 text-center"><UsersRound className="mx-auto text-fuchsia-300"/><h2 className="mt-3 font-display text-xl font-bold">Pedido enviado para a sala {lobby.pendingRequest.room.code}</h2><p className="mt-2 text-sm text-slate-400">Aguardando o dono permitir sua entrada. Esta tela atualiza automaticamente.</p><span className="mt-4 inline-flex animate-pulse rounded-full bg-fuchsia-300/10 px-4 py-2 text-xs font-bold text-fuchsia-200">Aguardando resposta…</span></section> : !lobby.currentRoom && <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="glass rounded-3xl p-7">
            <p className="eyebrow">Criar partida</p><h2 className="mt-2 font-display text-2xl font-bold">Sua sala, suas regras de aposta</h2>
            <label className="mt-6 block text-sm font-bold"><span className="mb-2 block">Aposta de cada jogador</span><input className="input" type="number" min="10" max="100" value={wager} onChange={(event) => setWager(Number(event.target.value))}/></label>
            <input aria-label="Aposta" className="mt-3 w-full accent-cyan-400" type="range" min="10" max="100" value={wager} onChange={(event) => setWager(Number(event.target.value))}/>
            <div className="mt-5 grid grid-cols-3 gap-3 text-center text-sm"><Summary label="Total apostado" value={`${settlement.total} DC`}/><Summary label="Vencedor" value={`${settlement.winnerPayout} DC`}/><Summary label="Imposto" value={`${settlement.taxAmount} DC`}/></div>
            <p className="mt-4 text-xs leading-relaxed text-slate-500">Quando 70% resultar em fração, o prêmio é arredondado para baixo e a diferença menor que 1 DC permanece no imposto. Limite: {PONG_DAILY_ROOM_LIMIT} salas por dia; restam {lobby.remainingCreations} hoje.</p>
            <button disabled={busy !== null || lobby.remainingCreations === 0 || !Number.isInteger(wager) || wager < 10 || wager > 100 || lobby.devCoins < PONG_ROOM_FEE + wager} onClick={createRoom} className="button-primary mt-6 w-full">{busy === "create" ? "Aguarde..." : `Criar sala por ${PONG_ROOM_FEE} DC`}</button>
            {lobby.devCoins < PONG_ROOM_FEE + wager && <p className="mt-3 text-center text-xs font-bold text-rose-300">Você precisa de pelo menos {PONG_ROOM_FEE + wager} DC para criar esta sala e reservar capacidade para a aposta.</p>}
          </section>
          <section className="glass rounded-3xl p-7">
            <p className="eyebrow">Entrar em uma partida</p><h2 className="mt-2 font-display text-2xl font-bold">Digite o código da sala</h2><p className="mt-3 text-sm leading-relaxed text-slate-400">O dono verá “{studentName} quer entrar na partida” e poderá permitir ou recusar.</p>
            <label className="mt-8 block text-sm font-bold"><span className="mb-2 block">Código numérico de 6 dígitos</span><div className="relative"><Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20}/><input inputMode="numeric" maxLength={6} className="input pl-12 font-mono text-2xl tracking-[.35em]" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000"/></div></label>
            <button disabled={busy !== null || code.length !== 6} onClick={requestJoin} className="button-secondary mt-6 w-full justify-center py-3">{busy === "join" ? "Aguarde..." : "Pedir para entrar"}</button>
          </section>
        </div>}
      </div>
    </div>
  </main>;
}

function Rule({ icon: Icon, title, text }: { icon: typeof Coins; title: string; text: string }) { return <article className="glass rounded-2xl p-5"><Icon className="text-cyan-300" size={20}/><h2 className="mt-4 font-bold">{title}</h2><p className="mt-2 text-xs leading-relaxed text-slate-400">{text}</p></article>; }
function Summary({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-white/5 p-3"><p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 font-bold text-cyan-200">{value}</p></div>; }
