"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Bot,
  Copy,
  DoorOpen,
  LoaderCircle,
  LogOut,
  MessageCircle,
  MoreHorizontal,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Share2,
  ShieldAlert,
  Trophy,
  UserPlus,
  Users,
  Wifi,
  WifiOff,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { LudoCanvasBoard } from "@/components/ludo-canvas-board";
import { LUDO_CHAT_MESSAGES, type LudoChatKey } from "@/lib/ludo-chat";
import { getProfileAvatar } from "@/lib/profile-avatars";
import { parsePieces, validPieceIndexesForPlayer, type LudoColor } from "@/lib/ludo-rules";

type Player = {
  id: string;
  studentId: string | null;
  kind: "STUDENT" | "BOT";
  name: string;
  profileAvatar: string;
  color: LudoColor;
  seat: number;
  status: string;
  pieces: unknown;
  stake: number;
  payout: number;
  finishPosition: number | null;
  connected: boolean;
  disconnectedAt: string | null;
};

type Room = {
  id: string;
  code: string;
  ownerId: string;
  ownerName: string;
  mode: "HUMAN" | "BOT";
  status: string;
  wager: number;
  roomFee: number;
  maxPlayers: number;
  initialPlayerCount: number | null;
  currentSeat: number;
  currentRoll: number | null;
  pauseRequestCount: number;
  turnDeadline: string | null;
  startedAt: string | null;
  pausedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  version: number;
  viewer: { xp: number; devCoins: number } | null;
  players: Player[];
  moves: Array<{
    id: string;
    playerId: string;
    sequence: number;
    kind: string;
    roll: number | null;
    pieceIndex: number | null;
    autoReason: string | null;
    createdAt: string;
  }>;
};

type OnlineStudent = { id: string; firstName: string; lastName: string; profileAvatar: string };
type Chat = { id: string; sender: string; text: string };
type Panel = "chat" | "players" | "controls" | null;

const PLAYER_COLOR: Record<LudoColor, string> = {
  RED: "#ef4444",
  GREEN: "#22c55e",
  YELLOW: "#facc15",
  BLUE: "#3b82f6",
};

const PLAYER_COLOR_CLASS: Record<LudoColor, string> = {
  RED: "border-red-400/50 bg-red-500/10",
  GREEN: "border-emerald-400/50 bg-emerald-500/10",
  YELLOW: "border-yellow-300/50 bg-yellow-400/10",
  BLUE: "border-blue-400/50 bg-blue-500/10",
};

const QUICK_EMOJIS: Array<{ key: LudoChatKey; emoji: string; label: string }> = [
  { key: "happy", emoji: "😄", label: "Feliz" },
  { key: "angry", emoji: "😡", label: "Raiva" },
  { key: "sad", emoji: "😢", label: "Triste" },
  { key: "afraid", emoji: "😨", label: "Medo" },
];

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

export function LudoRoomClient({ initialRoom, viewerId, realtimeConfigured }: {
  initialRoom: Room;
  viewerId: string;
  realtimeConfigured: boolean;
}) {
  const [room, setRoom] = useState(initialRoom);
  const [online, setOnline] = useState<OnlineStudent[]>([]);
  const [chat, setChat] = useState<Chat[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [now, setNow] = useState(0);
  const [realtime, setRealtime] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const ticking = useRef(false);

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/student/minigames/ludo/rooms/${room.id}`, { cache: "no-store" });
    const data = await response.json();
    if (response.ok) setRoom(data.room);
  }, [room.id]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let closed = false;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let fallback: ReturnType<typeof setInterval> | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;

    const connect = () => {
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(`${protocol}//${location.host}/api/student/minigames/ludo/ws`);
      socketRef.current = socket;
      socket.addEventListener("open", () => {
        setRealtime(true);
        heartbeat = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "heartbeat" }));
        }, 20_000);
      });
      socket.addEventListener("message", event => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === "ready") socket.send(JSON.stringify({ type: "subscribe-room", roomId: room.id }));
          if (message.type === "room" && message.roomId === room.id) void refresh();
          if (message.type === "chat" && message.roomId === room.id) {
            const item = { id: crypto.randomUUID(), sender: message.payload.sender, text: message.payload.text };
            setChat(current => [...current.slice(-5), item]);
            setTimeout(() => setChat(current => current.filter(value => value.id !== item.id)), 12_000);
          }
        } catch {
          // Mensagens inválidas são ignoradas sem interromper a partida.
        }
      });
      socket.addEventListener("close", () => {
        setRealtime(false);
        if (heartbeat) clearInterval(heartbeat);
        if (!closed) retry = setTimeout(connect, 2_000);
      });
    };

    connect();
    fallback = setInterval(() => {
      if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) void refresh();
    }, 5_000);
    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      if (fallback) clearInterval(fallback);
      if (heartbeat) clearInterval(heartbeat);
      socketRef.current?.close();
    };
  }, [refresh, room.id]);

  useEffect(() => {
    if (!panel) return;
    const originalOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPanel(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [panel]);

  useEffect(() => {
    if (room.status !== "WAITING" || room.ownerId !== viewerId || room.mode !== "HUMAN") return;
    const load = async () => {
      const response = await fetch("/api/student/minigames/ludo/presence", { cache: "no-store" });
      const data = await response.json();
      if (response.ok) {
        setOnline(data.students.filter((item: OnlineStudent) => !room.players.some(player => player.studentId === item.id)));
      }
    };
    void load();
    const timer = setInterval(load, 15_000);
    return () => clearInterval(timer);
  }, [room.mode, room.ownerId, room.players, room.status, viewerId]);

  const seconds = room.turnDeadline
    ? (now ? Math.max(0, Math.ceil((new Date(room.turnDeadline).getTime() - now) / 1000)) : 10)
    : 0;

  useEffect(() => {
    if (room.status !== "ACTIVE" || !room.turnDeadline || seconds > 0 || ticking.current) return;
    ticking.current = true;
    fetch(`/api/student/minigames/ludo/rooms/${room.id}/tick`, { method: "POST" })
      .then(response => response.json().then(data => ({ response, data })))
      .then(({ response, data }) => {
        if (response.ok) setRoom(data.room);
      })
      .finally(() => {
        ticking.current = false;
      });
  }, [room.id, room.status, room.turnDeadline, seconds]);

  async function action(name: string, body?: unknown) {
    setBusy(name);
    setError("");
    try {
      const response = await fetch(`/api/student/minigames/ludo/rooms/${room.id}/${name}`, {
        method: "POST",
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      if (data.room) setRoom(data.room);
      return data;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível realizar a ação.");
      return null;
    } finally {
      setBusy("");
    }
  }

  async function copy(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    alert(`${label} copiado.`);
  }

  async function invite(studentId: string) {
    const result = await action("invite", { inviteeId: studentId });
    if (result) {
      alert(result.chargedXp
        ? `Convite enviado. Foram descontados ${result.chargedXp} XP pelo novo pacote de cinco convites.`
        : `Convite enviado. Restam ${result.remainingInBatch} neste pacote.`);
    }
  }

  function sendChat(key: LudoChatKey) {
    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      setError("O chat rápido fica disponível quando a conexão em tempo real estiver ativa.");
      return;
    }
    socketRef.current.send(JSON.stringify({ type: "chat", roomId: room.id, key }));
  }

  const me = room.players.find(player => player.studentId === viewerId);
  const opponents = room.players.filter(player => player.studentId !== viewerId);
  const current = room.players.find(player => player.seat === room.currentSeat);
  const myTurn = room.status === "ACTIVE" && current?.studentId === viewerId && me?.status === "PLAYING";
  const valid = myTurn && room.currentRoll !== null && me
    ? validPieceIndexesForPlayer(
      room.players.map(player => ({ id: player.id, color: player.color, pieces: parsePieces(player.pieces) })),
      me.id,
      room.currentRoll,
    )
    : [];
  const owner = room.ownerId === viewerId;
  const timerProgress = room.status === "ACTIVE" ? Math.max(0, Math.min(1, seconds / 10)) : 0;

  return (
    <main
      className="min-h-screen bg-[#071b3b] text-white"
      style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(96,165,250,.18) 1.5px, transparent 0)", backgroundSize: "18px 18px" }}
    >
      <div className="mx-auto min-h-screen max-w-6xl bg-gradient-to-b from-[#0a2b5d]/90 via-[#081f44]/95 to-[#06162f] pb-28 shadow-2xl shadow-black/50 lg:px-8">
        <header className="sticky top-0 z-30 flex min-h-16 items-center gap-3 border-b border-white/10 bg-[#071b3b]/92 px-3 py-2 backdrop-blur-xl sm:min-h-20 sm:px-6">
          <Link href="/aluno/minigames/ludo" className="focus-ring grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/10" aria-label="Voltar para o Ludo Maker">
            <ArrowLeft size={22}/>
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-cyan-300">Sala Maker</p>
            <button onClick={() => void copy(room.code, "Código")} className="mt-0.5 flex min-h-8 items-center gap-2 text-left" aria-label={`Copiar código da sala ${room.code}`}>
              <strong className="font-mono text-xl tracking-[.18em] sm:text-2xl">{room.code}</strong>
              <Copy size={16} className="text-slate-300"/>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className={`hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold sm:flex ${realtime ? "bg-emerald-400/15 text-emerald-200" : "bg-amber-300/15 text-amber-100"}`}>
              {realtime ? <Wifi size={16}/> : <WifiOff size={16}/>} {realtime ? "Ao vivo" : realtimeConfigured ? "Reconectando" : "Atualização automática"}
            </span>
            <Status value={room.status}/>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[820px] px-3 pt-4 sm:px-6 sm:pt-6">
          {error && (
            <div role="alert" className="mb-4 flex items-start justify-between gap-3 rounded-2xl border border-rose-300/30 bg-rose-500/15 p-4 text-base text-rose-50">
              <span>{error}</span>
              <button onClick={() => setError("")} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-black/20" aria-label="Fechar aviso"><X size={18}/></button>
            </div>
          )}

          <section aria-label="Jogadores adversários" className={`mb-3 grid gap-2 ${opponents.length > 1 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1"}`}>
            {opponents.length ? opponents.map(player => (
              <PlayerCard
                key={player.id}
                player={player}
                active={current?.id === player.id && room.status === "ACTIVE"}
                seconds={seconds}
                progress={timerProgress}
                compact
              />
            )) : (
              <button onClick={() => setPanel("players")} className="flex min-h-16 items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-white/20 bg-white/5 px-4 text-base font-bold text-slate-200">
                <UserPlus size={22} className="text-cyan-300"/> Aguardando outro jogador
              </button>
            )}
          </section>

          <section className="rounded-[1.75rem] border border-white/10 bg-[#081a35]/92 p-2 shadow-[0_30px_100px_rgba(0,0,0,.45)] sm:p-4">
            <LudoCanvasBoard
              players={room.players}
              viewerId={viewerId}
              valid={valid}
              onPiece={pieceIndex => void action("move", { pieceIndex })}
            />
          </section>

          {chat.length > 0 && (
            <div aria-live="polite" className="pointer-events-none fixed inset-x-3 bottom-28 z-40 mx-auto max-w-md space-y-2 sm:inset-x-auto sm:right-6">
              {chat.slice(-2).map(message => (
                <p key={message.id} className="rounded-2xl border border-white/15 bg-slate-950/90 px-4 py-3 text-base shadow-xl backdrop-blur">
                  <strong className="text-cyan-300">{firstName(message.sender)}:</strong> {message.text}
                </p>
              ))}
            </div>
          )}

          {me && (
            <div className="mt-3">
              <PlayerCard
                player={me}
                active={current?.id === me.id && room.status === "ACTIVE"}
                seconds={seconds}
                progress={timerProgress}
                isViewer
              />
            </div>
          )}

          <TurnControl
            room={room}
            current={current}
            owner={owner}
            myTurn={myTurn}
            seconds={seconds}
            busy={busy}
            action={action}
          />

          <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-slate-950/45 p-2 text-sm font-bold sm:grid-cols-5">
            <InfoPill label="Aposta" value={`${room.wager} DC`}/>
            <InfoPill label="Jogadores" value={`${room.players.length}/${room.maxPlayers}`}/>
            <InfoPill label="Seu saldo" value={`${room.viewer?.devCoins ?? "—"} DC`}/>
            <InfoPill label="Seu XP" value={`${room.viewer?.xp ?? "—"} XP`} extraClass="hidden sm:block"/>
            <button onClick={() => void copy(`${location.origin}/aluno/minigames/ludo?codigo=${room.code}`, "Link")} className="focus-ring hidden min-h-14 items-center justify-center gap-2 rounded-xl bg-white/7 px-3 sm:flex">
              <Share2 size={18}/> Convidar
            </button>
          </div>
        </div>

        <QuickDock realtime={realtime} openPanel={setPanel} sendChat={sendChat}/>
      </div>

      {panel && (
        <BottomSheet title={panelTitle(panel)} onClose={() => setPanel(null)}>
          {panel === "chat" && <ChatPanel messages={chat} realtime={realtime} send={sendChat}/>}
          {panel === "players" && <PlayersPanel room={room} online={online} owner={owner} busy={busy === "invite"} invite={invite}/>}
          {panel === "controls" && (
            <div className="space-y-6">
              <ActionsPanel room={room} owner={owner} busy={busy} action={action}/>
              <div><h3 className="mb-3 text-xl font-black">Regras rápidas</h3><RulesPanel room={room}/></div>
            </div>
          )}
        </BottomSheet>
      )}
    </main>
  );
}

function PlayerCard({ player, active, seconds, progress, compact = false, isViewer = false }: {
  player: Player;
  active: boolean;
  seconds: number;
  progress: number;
  compact?: boolean;
  isViewer?: boolean;
}) {
  const ring = active
    ? `conic-gradient(${PLAYER_COLOR[player.color]} ${progress * 360}deg, rgba(51,65,85,.65) 0)`
    : "rgba(51,65,85,.65)";
  return (
    <article className={`flex min-w-0 items-center gap-3 rounded-2xl border p-2.5 shadow-lg ${PLAYER_COLOR_CLASS[player.color]} ${active ? "ring-2 ring-white/80" : ""} ${compact ? "min-h-16" : "min-h-[76px]"}`}>
      <div className="relative grid h-13 w-13 shrink-0 place-items-center rounded-full p-[3px] sm:h-15 sm:w-15" style={{ background: ring }}>
        <div className="relative grid h-full w-full place-items-center overflow-hidden rounded-full border-2 border-slate-950 bg-slate-800">
          {player.kind === "BOT" ? <Bot size={28} className="text-fuchsia-200"/> : (
            <Image src={getProfileAvatar(player.profileAvatar)} alt={`Foto de ${player.name}`} fill sizes="60px" className="object-cover"/>
          )}
        </div>
        {active && <span className="absolute -bottom-1 rounded-full bg-slate-950 px-2 py-0.5 text-xs font-black">{seconds}s</span>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <strong className="truncate text-base sm:text-lg">{firstName(player.name)}{isViewer ? " · você" : ""}</strong>
          {player.finishPosition && <span className="rounded-full bg-yellow-300 px-2 py-0.5 text-xs font-black text-slate-950">{player.finishPosition}º</span>}
        </div>
        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-200">
          <span className={`h-2.5 w-2.5 rounded-full ${player.connected || player.kind === "BOT" || isViewer ? "bg-emerald-300" : "bg-slate-500"}`}/>
          {player.status === "FORFEITED" ? "Desistiu" : player.kind === "BOT" ? "IA do professor" : player.connected || isViewer ? "Online" : "Desconectado"}
        </p>
      </div>
      {!compact && <span className="rounded-xl bg-black/20 px-3 py-2 text-sm font-black">{player.payout > 0 ? `+${player.payout} DC` : `${player.stake} DC`}</span>}
    </article>
  );
}

function TurnControl({ room, current, owner, myTurn, seconds, busy, action }: {
  room: Room;
  current?: Player;
  owner: boolean;
  myTurn: boolean;
  seconds: number;
  busy: string;
  action: (name: string, body?: unknown) => Promise<unknown>;
}) {
  if (room.status === "WAITING") {
    return (
      <section className="mt-3 rounded-2xl border border-cyan-300/20 bg-cyan-300/8 p-4 text-center">
        <h2 className="text-xl font-black">Monte sua equipe</h2>
        <p className="mt-1 text-base text-slate-200">Compartilhe o código e inicie quando houver pelo menos dois jogadores.</p>
        {owner && (
          <button disabled={room.players.length < 2 || Boolean(busy)} onClick={() => action("start")} className="button-primary mt-4 min-h-13 w-full text-base disabled:cursor-not-allowed disabled:opacity-45">
            {busy === "start" ? <LoaderCircle className="animate-spin" size={20}/> : <Play size={20}/>} Iniciar partida · 100 XP
          </button>
        )}
      </section>
    );
  }

  if (room.status === "PAUSED") return <StateCard icon={<Pause size={28}/>} title="Circuito pausado" text="A partida está salva e pode ser retomada pelo dono da sala."/>;
  if (room.status === "FINISHED") return <StateCard icon={<Trophy size={30}/>} title="Missão concluída!" text="As colocações e prêmios aparecem nos cartões dos jogadores."/>;
  if (room.status !== "ACTIVE") return null;

  return (
    <section className={`mt-3 rounded-2xl border p-4 ${myTurn ? "border-cyan-300/60 bg-cyan-300/10 shadow-[0_0_35px_rgba(34,211,238,.12)]" : "border-white/10 bg-white/5"}`}>
      <div className="flex items-center gap-4">
        <div className="grid h-17 w-17 shrink-0 place-items-center rounded-2xl border border-white/15 bg-slate-950/60">
          <span className="text-xs font-bold uppercase text-slate-400">Número</span>
          <strong className="text-3xl leading-none">{room.currentRoll ?? "?"}</strong>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold uppercase tracking-wider text-cyan-300">{myTurn ? "Sua vez" : "Jogando agora"}</p>
          <h2 className="truncate text-xl font-black">{current ? firstName(current.name) : "Aguardando"}</h2>
          <p className="text-sm text-slate-300">{room.currentRoll ? "Escolha um robô destacado" : `${seconds}s para sortear`}</p>
        </div>
        <button
          disabled={!myTurn || room.currentRoll !== null || Boolean(busy)}
          onClick={() => action("roll")}
          className="focus-ring grid min-h-17 min-w-17 place-items-center rounded-2xl bg-gradient-to-br from-cyan-300 to-blue-500 text-slate-950 shadow-lg disabled:cursor-not-allowed disabled:grayscale"
          aria-label="Sortear número de um a seis"
        >
          {busy === "roll" ? <LoaderCircle className="animate-spin" size={28}/> : <RefreshCw size={28}/>}
          <span className="text-xs font-black">Sortear</span>
        </button>
      </div>
    </section>
  );
}

function StateCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <section className="mt-3 flex items-center gap-4 rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 text-amber-50">
      <span className="grid h-13 w-13 shrink-0 place-items-center rounded-2xl bg-amber-300/15">{icon}</span>
      <div><h2 className="text-xl font-black">{title}</h2><p className="mt-1 text-base">{text}</p></div>
    </section>
  );
}

function InfoPill({ label, value, extraClass = "" }: { label: string; value: string; extraClass?: string }) {
  return <div className={`min-h-14 rounded-xl bg-white/7 px-3 py-2 ${extraClass}`}><span className="block text-xs text-slate-400">{label}</span><strong className="mt-0.5 block text-base">{value}</strong></div>;
}

function QuickDock({ realtime, openPanel, sendChat }: {
  realtime: boolean;
  openPanel: (panel: Panel) => void;
  sendChat: (key: LudoChatKey) => void;
}) {
  return (
    <nav aria-label="Ações rápidas do jogo" className="fixed inset-x-2 bottom-2 z-40 mx-auto flex max-w-xl items-center gap-1 rounded-[1.4rem] border border-white/15 bg-slate-950/94 p-2 shadow-2xl backdrop-blur-xl sm:bottom-4 sm:gap-2 md:inset-x-auto md:bottom-auto md:right-5 md:top-1/2 md:w-16 md:-translate-y-1/2 md:flex-col">
      <button onClick={() => openPanel("chat")} className="focus-ring grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-cyan-300 text-slate-950" aria-label="Abrir chat rápido"><MessageCircle size={23}/></button>
      <div className="grid min-w-0 flex-1 grid-cols-3 gap-1 sm:grid-cols-4 md:w-full md:grid-cols-1">
        {QUICK_EMOJIS.map((item, index) => (
          <button disabled={!realtime} onClick={() => sendChat(item.key)} key={item.key} className={`focus-ring h-12 place-items-center rounded-xl bg-white/7 text-2xl disabled:opacity-45 ${index === 3 ? "hidden sm:grid" : "grid"}`} aria-label={`Enviar emoji de ${item.label}`}>{item.emoji}</button>
        ))}
      </div>
      <button onClick={() => openPanel("players")} className="focus-ring grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10" aria-label="Ver jogadores e convidar"><Users size={22}/></button>
      <button onClick={() => openPanel("controls")} className="focus-ring grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10" aria-label="Abrir controles e regras"><MoreHorizontal size={24}/></button>
    </nav>
  );
}

function BottomSheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 bg-slate-950/72 backdrop-blur-sm" onClick={onClose} aria-label="Fechar painel"/>
      <section className="relative z-10 max-h-[82dvh] w-full overflow-y-auto rounded-t-[2rem] border border-white/15 bg-[#0b1930] p-5 shadow-2xl sm:mr-5 sm:max-w-md sm:rounded-[2rem] sm:p-6">
        <header className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-2xl font-black">{title}</h2>
          <button onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full bg-white/10" aria-label="Fechar"><X size={22}/></button>
        </header>
        {children}
      </section>
    </div>
  );
}

function ChatPanel({ messages, realtime, send }: { messages: Chat[]; realtime: boolean; send: (key: LudoChatKey) => void }) {
  return (
    <div>
      <p className="rounded-xl bg-white/5 p-3 text-sm text-slate-300">Mensagens rápidas desaparecem e não são salvas no banco.</p>
      {!realtime && <p className="mt-3 rounded-xl border border-amber-300/25 bg-amber-300/10 p-3 text-sm text-amber-100">O chat aguarda a conexão em tempo real.</p>}
      {messages.length > 0 && <div className="mt-4 space-y-2">{messages.map(message => <p key={message.id} className="rounded-xl bg-slate-950/60 p-3 text-base"><strong className="text-cyan-300">{firstName(message.sender)}:</strong> {message.text}</p>)}</div>}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {(Object.entries(LUDO_CHAT_MESSAGES) as [LudoChatKey, string][]).map(([key, text]) => (
          <button disabled={!realtime} key={key} onClick={() => send(key)} className="focus-ring min-h-14 rounded-xl border border-white/10 bg-white/7 p-3 text-left text-base font-bold disabled:opacity-45">{text}</button>
        ))}
      </div>
    </div>
  );
}

function PlayersPanel({ room, online, owner, busy, invite }: {
  room: Room;
  online: OnlineStudent[];
  owner: boolean;
  busy: boolean;
  invite: (id: string) => void;
}) {
  return (
    <div>
      <div className="space-y-2">
        {room.players.map(player => <PlayerCard key={player.id} player={player} active={false} seconds={0} progress={0}/>) }
      </div>
      {room.status === "WAITING" && owner && room.mode === "HUMAN" && (
        <section className="mt-6">
          <h3 className="flex items-center gap-2 text-lg font-black"><Radio className="text-emerald-300"/>Alunos online</h3>
          <p className="mt-2 text-sm text-slate-300">Cada pacote de cinco convites para a mesma pessoa custa 10 XP.</p>
          <div className="mt-3 space-y-2">
            {online.length ? online.map(student => (
              <button disabled={busy} onClick={() => invite(student.id)} key={student.id} className="flex min-h-14 w-full items-center gap-3 rounded-xl bg-white/7 p-3 text-left text-base font-bold">
                <span className="relative h-11 w-11 overflow-hidden rounded-full"><Image src={getProfileAvatar(student.profileAvatar)} alt="" fill sizes="44px" className="object-cover"/></span>
                <span className="min-w-0 flex-1 truncate">{student.firstName} {student.lastName}</span>
                <UserPlus size={20}/>
              </button>
            )) : <p className="rounded-xl bg-white/5 p-4 text-center text-base text-slate-400">Nenhum colega online agora.</p>}
          </div>
        </section>
      )}
    </div>
  );
}

function RulesPanel({ room }: { room: Room }) {
  return (
    <div className="space-y-3 text-base leading-relaxed text-slate-200">
      <Rule icon={<Zap/>} title="Saída da oficina">Cada jogador possui quatro robôs. Eles só entram na pista quando o número 6 é sorteado.</Rule>
      <Rule icon={<Trophy/>} title="Prêmios">Com dois jogadores, o vencedor recebe 80%. Com três ou quatro, o 1º recebe 60% e o 2º recebe 20%.</Rule>
      <Rule icon={<ShieldAlert/>} title="Casas seguras">As estrelas douradas no tabuleiro protegem o robô contra captura.</Rule>
      <Rule icon={<RefreshCw/>} title="Tempo">Você tem 10 segundos para sortear e 10 segundos para escolher um robô. Depois, o jogo decide automaticamente.</Rule>
      <Rule icon={<LogOut/>} title="Desistência">Desistir desconta 100 XP adicionais e mantém a aposta no pote. Após três minutos desconectado, ocorre desistência automática.</Rule>
      {room.mode === "BOT" && <Rule icon={<Bot/>} title="IA do professor">Há mais chances da IA do professor ganhar.</Rule>}
    </div>
  );
}

function Rule({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return <article className="rounded-2xl bg-white/6 p-4"><h3 className="flex items-center gap-2 text-lg font-black text-cyan-200">{icon}{title}</h3><p className="mt-2">{children}</p></article>;
}

function ActionsPanel({ room, owner, busy, action }: {
  room: Room;
  owner: boolean;
  busy: string;
  action: (name: string, body?: unknown) => Promise<unknown>;
}) {
  return (
    <div className="grid gap-3">
      <button onClick={() => void navigator.clipboard.writeText(`${location.origin}/aluno/minigames/ludo?codigo=${room.code}`)} className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-cyan-300 font-black text-slate-950"><Share2/>Copiar convite</button>
      <button onClick={() => location.reload()} className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-white/10 font-bold"><RefreshCw/>Atualizar partida</button>
      {room.status === "WAITING" && (
        <button disabled={Boolean(busy)} className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-rose-300/30 bg-rose-500/15 font-bold text-rose-100" onClick={() => {
          if (confirm(owner ? "Cancelar a sala? A taxa de 50 DC não será devolvida; as apostas serão." : "Sair da sala? Sua aposta será devolvida.")) void action(owner ? "cancel" : "leave");
        }}>
          {owner ? <XCircle/> : <DoorOpen/>} {owner ? "Cancelar sala" : "Sair da sala"}
        </button>
      )}
      {room.status === "ACTIVE" && (
        <>
          <button disabled={Boolean(busy)} className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-amber-300 font-black text-slate-950" onClick={() => action("pause")}>
            <Pause/>{owner ? "Continuar mais tarde" : room.initialPlayerCount === 2 ? `Pedir pausa (${room.pauseRequestCount}/3)` : "Pedir para pausar"}
          </button>
          <button disabled={Boolean(busy)} className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-rose-300/30 bg-rose-500/15 font-bold text-rose-100" onClick={() => {
            if (confirm("Desistir desconta 100 XP adicionais e a aposta permanece no pote. Confirmar?")) void action("forfeit");
          }}><LogOut/>Desistir</button>
        </>
      )}
      {room.status === "PAUSED" && owner && <button disabled={Boolean(busy)} className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-emerald-400 font-black text-slate-950" onClick={() => action("resume")}><Play/>Continuar partida</button>}
    </div>
  );
}

function Status({ value }: { value: string }) {
  const labels: Record<string, string> = { WAITING: "Aguardando", ACTIVE: "Em jogo", PAUSED: "Pausada", FINISHED: "Finalizada", CANCELLED: "Cancelada" };
  return <span className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-sm font-black">{labels[value] ?? value}</span>;
}

function panelTitle(panel: Exclude<Panel, null>) {
  return { chat: "Chat rápido", players: "Jogadores", controls: "Controles e regras" }[panel];
}
