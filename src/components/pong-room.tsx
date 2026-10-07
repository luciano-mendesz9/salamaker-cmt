"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Clock3, Gamepad2, LogOut, Radio, Trophy, UserRound, WifiOff, X } from "lucide-react";
import { toast } from "sonner";
import { PongCanvas } from "@/components/pong-canvas";
import { createPongPhysicsState, PONG_LOSER_XP_PENALTY, type PongPhysicsState, type PongSeat } from "@/lib/pong-rules";

type Player = {
  id: string;
  studentId: string;
  seat: PongSeat;
  status: string;
  connected: boolean;
  disconnectedAt: string | null;
  disconnectDeadline: string | null;
  payout: number;
  student: { id: string; firstName: string; lastName: string; profileAvatar: string };
};

type Room = {
  id: string;
  code: string;
  status: "WAITING" | "ACTIVE" | "FINISHED" | "CANCELLED";
  wager: number;
  roomFee: number;
  ownerScore: number;
  guestScore: number;
  scoreSequence: number;
  winnerId: string | null;
  loserId: string | null;
  finishReason: "SCORE" | "DISCONNECTION" | "FORFEIT" | null;
  winnerPayout: number;
  taxAmount: number;
  isOwner: boolean;
  viewerSeat: PongSeat;
  settlement: { total: number; winnerPayout: number; taxAmount: number };
  owner: { id: string; firstName: string; lastName: string; profileAvatar: string };
  winner: { id: string; firstName: string; lastName: string } | null;
  loser: { id: string; firstName: string; lastName: string } | null;
  players: Player[];
  joinRequests: Array<{ id: string; studentId: string; createdAt: string; expiresAt: string; student: { id: string; firstName: string; lastName: string; profileAvatar: string } }>;
};

export function PongRoom({ initialRoom, studentId }: { initialRoom: Room; studentId: string }) {
  const [room, setRoom] = useState(initialRoom);
  const [frame, setFrame] = useState<PongPhysicsState>(() => createPongPhysicsState(initialRoom.ownerScore, initialRoom.guestScore, initialRoom.scoreSequence));
  const [busy, setBusy] = useState<string | null>(null);
  const [socketState, setSocketState] = useState<"connecting" | "online" | "offline">("connecting");
  const [now, setNow] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  const eventsRef = useRef<EventSource | null>(null);
  const reconnectRef = useRef<number | null>(null);
  const shouldReconnect = useRef(true);
  const usingEventsFallback = useRef(false);

  const refreshRoom = useCallback(async () => {
    const response = await fetch(`/api/student/minigames/pong/rooms/${room.id}`, { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as { room: Room };
    setRoom(data.room);
  }, [room.id]);

  useEffect(() => {
    const timer = window.setInterval(() => { void refreshRoom(); setNow(Date.now()); }, room.status === "ACTIVE" ? 3_000 : 2_000);
    return () => window.clearInterval(timer);
  }, [refreshRoom, room.status]);

  useEffect(() => {
    shouldReconnect.current = true;
    usingEventsFallback.current = false;
    const receive = (value: string) => {
      try {
        const message = JSON.parse(value) as { type?: string; payload?: unknown };
        if (message.type === "frame") setFrame(message.payload as PongPhysicsState);
        if (message.type === "room" || message.type === "join-request" || message.type === "result") void refreshRoom();
      } catch { /* Ignore malformed network frames. */ }
    };
    const connectEventsFallback = () => {
      if (!shouldReconnect.current || usingEventsFallback.current) return;
      usingEventsFallback.current = true;
      const events = new EventSource(`/api/student/minigames/pong/events?roomId=${encodeURIComponent(room.id)}`);
      eventsRef.current = events;
      events.onopen = () => setSocketState("online");
      events.onmessage = (event) => receive(event.data);
      events.onerror = () => setSocketState("connecting");
    };
    const connect = () => {
      if (!shouldReconnect.current || usingEventsFallback.current) return;
      setSocketState("connecting");
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(`${protocol}//${window.location.host}/api/student/minigames/pong/ws`);
      socketRef.current = socket;
      socket.onopen = () => {
        setSocketState("online");
        socket.send(JSON.stringify({ type: "subscribe-room", roomId: room.id }));
      };
      socket.onmessage = (event) => receive(event.data);
      socket.onerror = () => { setSocketState("connecting"); connectEventsFallback(); };
      socket.onclose = () => {
        if (!usingEventsFallback.current) {
          setSocketState("connecting");
          if (shouldReconnect.current) reconnectRef.current = window.setTimeout(connect, 2_000);
        }
      };
    };
    connect();
    const heartbeat = window.setInterval(() => {
      if (socketRef.current?.readyState === WebSocket.OPEN) socketRef.current.send(JSON.stringify({ type: "heartbeat" }));
    }, 15_000);
    return () => {
      shouldReconnect.current = false;
      window.clearInterval(heartbeat);
      if (reconnectRef.current) window.clearTimeout(reconnectRef.current);
      socketRef.current?.close();
      eventsRef.current?.close();
    };
  }, [refreshRoom, room.id]);

  useEffect(() => {
    if (room.status !== "ACTIVE") return;
    const pressed = new Set<string>();
    const send = () => {
      const left = pressed.has("a") || pressed.has("arrowleft");
      const right = pressed.has("d") || pressed.has("arrowright");
      const direction = left === right ? 0 : left ? -1 : 1;
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: "input", direction }));
      } else if (usingEventsFallback.current) {
        void fetch("/api/student/minigames/pong/events", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ roomId: room.id, direction }),
        });
      }
    };
    const down = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (!["a", "d", "arrowleft", "arrowright"].includes(key)) return;
      event.preventDefault();
      if (!pressed.has(key)) { pressed.add(key); send(); }
    };
    const up = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (!["a", "d", "arrowleft", "arrowright"].includes(key)) return;
      event.preventDefault();
      if (pressed.delete(key)) send();
    };
    const blur = () => { pressed.clear(); send(); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); };
  }, [room.id, room.status]);

  const viewer = room.players.find((player) => player.studentId === studentId);
  const opponent = room.players.find((player) => player.studentId !== studentId);
  const viewerScore = room.viewerSeat === "OWNER" ? frame.ownerScore : frame.guestScore;
  const opponentScore = room.viewerSeat === "OWNER" ? frame.guestScore : frame.ownerScore;
  const disconnecting = room.players.find((player) => !player.connected && player.disconnectedAt && player.status === "PLAYING");
  const disconnectSeconds = disconnecting?.disconnectDeadline ? Math.max(0, Math.ceil((new Date(disconnecting.disconnectDeadline).getTime() - now) / 1000)) : null;

  async function mutate(path: string, method = "POST", body?: unknown) {
    setBusy(path);
    const response = await fetch(`/api/student/minigames/pong/rooms/${room.id}/${path}`, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const data = await response.json();
    setBusy(null);
    if (!response.ok) { toast.error(data.message); return null; }
    if (data.room) setRoom(data.room);
    return data;
  }

  async function answer(requestId: string, accept: boolean) {
    const data = await mutate(`requests/${requestId}`, "PATCH", { accept });
    if (data) toast.success(accept ? "Entrada permitida." : "Pedido recusado.");
  }

  if (room.status === "CANCELLED") return <main className="mesh grid min-h-screen place-items-center p-5"><section className="glass max-w-lg rounded-3xl p-8 text-center"><X className="mx-auto text-rose-300" size={40}/><h1 className="mt-4 font-display text-2xl font-bold">Sala cancelada</h1><p className="mt-3 text-slate-400">A taxa de abertura não é devolvida.</p><Link href="/aluno/minigames" className="button-primary mt-6">Voltar aos minigames</Link></section></main>;

  return <main className="min-h-screen bg-[#030609] text-white">
    <section className="md:hidden"><div className="grid min-h-screen place-items-center p-5"><div className="glass max-w-lg rounded-3xl p-8 text-center"><Gamepad2 className="mx-auto text-cyan-300" size={42}/><h1 className="mt-5 font-display text-2xl font-bold">Esta partida precisa de um computador</h1><p className="mt-3 text-sm leading-relaxed text-slate-400">O Pong usa as teclas A/D ou ←/→ e não funciona no celular.</p><Link href="/aluno/minigames" className="button-secondary mt-6">Voltar</Link></div></div></section>
    <div className="mx-auto hidden min-h-screen max-w-7xl px-6 py-5 md:block">
      <header className="flex items-center justify-between border-b border-white/10 pb-5"><div><p className="text-xs font-bold uppercase tracking-[.24em] text-cyan-300">Sala {room.code}</p><h1 className="mt-1 font-display text-2xl font-bold">Pong multiplayer</h1></div><div className="flex items-center gap-3"><span className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold ${socketState === "online" ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-200"}`}><Radio size={14}/>{socketState === "online" ? "Tempo real conectado" : "Reconectando…"}</span><Link href="/aluno/minigames" className="button-secondary py-2 text-sm">Lobby</Link></div></header>

      {room.status === "WAITING" && <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
        <section className="rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-[#071a24] to-[#100817] p-8">
          <p className="eyebrow">Código para entrar</p><p className="mt-4 font-mono text-6xl font-black tracking-[.2em] text-cyan-200">{room.code}</p><p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-400">O segundo jogador digita este código no lobby. Você verá o pedido antes de permitir a entrada.</p>
          <div className="mt-7 grid grid-cols-3 gap-3"><Fact label="Aposta de cada um" value={`${room.wager} DC`}/><Fact label="Prêmio do vencedor" value={`${room.settlement.winnerPayout} DC`}/><Fact label="Imposto" value={`${room.settlement.taxAmount} DC`}/></div>
          <div className="mt-7 space-y-3">{room.players.map((player) => <div key={player.id} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/20 p-4"><span className="grid h-11 w-11 place-items-center rounded-full bg-cyan-300/10 text-cyan-200"><UserRound/></span><div><p className="font-bold">{player.student.firstName} {player.student.lastName}</p><p className="text-xs text-slate-500">{player.seat === "OWNER" ? "Dono da sala" : "Convidado aprovado"}</p></div><span className={`ml-auto rounded-full px-3 py-1 text-xs font-bold ${player.connected ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-200"}`}>{player.connected ? "Conectado" : "Conectando…"}</span></div>)}</div>
          {room.isOwner ? <div className="mt-7 flex gap-3"><button disabled={busy !== null || room.players.length !== 2 || room.players.some((player) => !player.connected)} onClick={() => void mutate("start")} className="button-primary">{busy === "start" ? "Aguarde..." : "Iniciar e debitar apostas"}</button><button disabled={busy !== null} onClick={() => void mutate("cancel")} className="button-secondary text-rose-200">Cancelar sala</button></div> : <div className="mt-7 rounded-2xl border border-fuchsia-300/20 bg-fuchsia-300/8 p-4 text-sm text-fuchsia-100">Entrada permitida. Aguardando o dono iniciar a partida.</div>}
        </section>
        <aside className="glass rounded-3xl p-6"><h2 className="flex items-center gap-2 font-display text-xl font-bold"><Clock3 className="text-fuchsia-300"/>Pedidos de entrada</h2>{!room.isOwner ? <p className="mt-4 text-sm text-slate-400">Somente o dono responde aos pedidos.</p> : room.joinRequests.length ? <div className="mt-5 space-y-4">{room.joinRequests.map((request) => <article key={request.id} className="rounded-2xl border border-fuchsia-300/20 bg-fuchsia-300/5 p-5"><p className="font-bold">{request.student.firstName} {request.student.lastName} quer entrar na partida</p><p className="mt-1 text-xs text-slate-500">O saldo será validado novamente ao iniciar.</p><div className="mt-4 flex gap-2"><button disabled={busy !== null || room.players.length >= 2} onClick={() => void answer(request.id, true)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold"><Check size={16}/>Permitir</button><button disabled={busy !== null} onClick={() => void answer(request.id, false)} className="inline-flex items-center gap-2 rounded-xl border border-rose-300/30 px-4 py-2 text-sm font-bold text-rose-200"><X size={16}/>Recusar</button></div></article>)}</div> : <div className="mt-6 rounded-2xl border border-dashed border-slate-700 p-7 text-center text-sm text-slate-500">Nenhum pedido pendente.</div>}</aside>
      </div>}

      {room.status === "ACTIVE" && <div className="mt-6">
        <div className="mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-5"><PlayerLabel name={opponent ? `${opponent.student.firstName} ${opponent.student.lastName}` : "Adversário"} detail="adversário · raquete superior" align="left"/><div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-6 py-3"><span className="text-3xl font-black text-fuchsia-300">{opponentScore}</span><span className="text-slate-600">×</span><span className="text-3xl font-black text-cyan-300">{viewerScore}</span></div><PlayerLabel name={viewer ? `${viewer.student.firstName} ${viewer.student.lastName}` : "Você"} detail="você · raquete inferior" align="right"/></div>
        {disconnecting && <div className="mb-4 flex items-center gap-3 rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100"><WifiOff size={19}/><strong>{disconnecting.studentId === studentId ? "Você está reconectando." : `${disconnecting.student.firstName} desconectou.`}</strong><span>Derrota por desconexão em {disconnectSeconds ?? 180}s se a conexão não voltar.</span></div>}
        <PongCanvas frame={frame} viewerSeat={room.viewerSeat}/>
        <div className="mt-4 flex items-center justify-between"><div><p className="font-bold text-cyan-200">Mover: A / D ou ← / →</p><p className="mt-1 text-xs text-slate-500">Primeiro a 10 pontos vence · velocidade nível {frame.speedLevel + 1}</p></div><button disabled={busy !== null} onClick={() => { if (window.confirm("Desistir agora? Você perderá a aposta e 50 XP.")) void mutate("forfeit"); }} className="inline-flex items-center gap-2 rounded-xl border border-rose-300/25 px-4 py-3 text-sm font-bold text-rose-200"><LogOut size={17}/>Desistir da partida</button></div>
      </div>}

      {room.status === "FINISHED" && <Result room={room} studentId={studentId}/>}
    </div>
  </main>;
}

function Fact({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-black/20 p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-bold text-cyan-100">{value}</p></div>; }
function PlayerLabel({ name, detail, align }: { name: string; detail: string; align: "left" | "right" }) { return <div className={align === "right" ? "text-right" : "text-left"}><p className="font-bold">{name}</p><p className="text-xs text-slate-500">{detail}</p></div>; }

function Result({ room, studentId }: { room: Room; studentId: string }) {
  const won = room.winnerId === studentId;
  const reason = room.finishReason === "DISCONNECTION" ? "desconexão do adversário" : room.finishReason === "FORFEIT" ? "desistência do adversário" : "10 pontos alcançados";
  const pieces = useMemo(() => Array.from({ length: 18 }, (_, index) => ({ left: `${(index * 37) % 100}%`, delay: `${(index % 6) * .12}s`, color: index % 2 ? "#67e8f9" : "#f472b6" })), []);
  return <section className={`relative mx-auto mt-10 max-w-3xl overflow-hidden rounded-3xl border p-10 text-center ${won ? "pong-winner border-cyan-300/30 bg-cyan-300/8" : "pong-loser border-rose-300/25 bg-rose-300/7"}`}>
    {won && pieces.map((piece, index) => <i key={index} className="pong-confetti" style={{ left: piece.left, animationDelay: piece.delay, backgroundColor: piece.color }}/>) }
    <span className={`relative mx-auto grid h-20 w-20 place-items-center rounded-full ${won ? "bg-amber-300/15 text-amber-200" : "bg-rose-300/10 text-rose-200"}`}>{won ? <Trophy size={40}/> : <Gamepad2 size={40}/>}</span>
    <p className="relative mt-6 text-xs font-bold uppercase tracking-[.24em] text-slate-400">Partida encerrada por {reason}</p>
    <h1 className="relative mt-3 font-display text-5xl font-black">{won ? "Você venceu!" : "Você perdeu"}</h1>
    <p className="relative mt-4 text-lg text-slate-300">Placar final: {room.ownerScore} × {room.guestScore}</p>
    <div className="relative mx-auto mt-7 grid max-w-xl grid-cols-3 gap-3"><Fact label={won ? "Seu prêmio" : "Aposta perdida"} value={won ? `+${room.winnerPayout} DC` : `-${room.wager} DC`}/><Fact label="Imposto" value={`${room.taxAmount} DC`}/><Fact label="XP do perdedor" value={`-${PONG_LOSER_XP_PENALTY} XP`}/></div>
    <div className="relative mt-8 flex justify-center gap-3"><Link href="/aluno/minigames" className="button-primary">Jogar novamente</Link><Link href="/aluno" className="button-secondary">Voltar ao painel</Link></div>
  </section>;
}
