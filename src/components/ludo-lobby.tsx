"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Bot, CircleDollarSign, Clock3, DoorOpen, History, LoaderCircle, Play, Plus, Radio, ShieldCheck, Swords, Trophy } from "lucide-react";

type RoomSummary = { id: string; code: string; status: string; mode: "HUMAN" | "BOT"; wager: number; ownerName: string; players: Array<{ id: string; name: string; color: string; finishPosition: number | null }>; finishedAt: string | null; createdAt: string };
type Invitation = { id: string; inviterName: string; roomCode: string; wager: number; players: number; expiresAt: string };

export function LudoLobby({ student, initialCode }: { student: { id: string; firstName: string; xp: number; devCoins: number }; initialCode: string }) {
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [mode, setMode] = useState<"HUMAN" | "BOT">("HUMAN");
  const [wager, setWager] = useState(10);
  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [realtimeReady, setRealtimeReady] = useState(true);

  const load = useCallback(async () => {
    const response = await fetch("/api/student/minigames/ludo/rooms", { cache: "no-store" });
    const data = await response.json();
    if (response.ok) { setRooms(data.rooms); setInvitations(data.invitations); setRealtimeReady(data.realtimeConfigured); }
    setLoaded(true);
  }, []);
  useEffect(() => { const initialLoad = setTimeout(() => void load(), 0); const handler = () => void load(); window.addEventListener("ludo-realtime", handler); return () => { clearTimeout(initialLoad); window.removeEventListener("ludo-realtime", handler); }; }, [load]);

  async function createRoom() {
    setBusy("create"); setError("");
    try {
      const response = await fetch("/api/student/minigames/ludo/rooms", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode, wager: mode === "BOT" ? 50 : wager, requestId: crypto.randomUUID() }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message);
      router.push(`/aluno/minigames/ludo/${data.room.id}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível abrir a sala."); }
    finally { setBusy(""); }
  }
  async function joinRoom() {
    setBusy("join"); setError("");
    try {
      const response = await fetch("/api/student/minigames/ludo/rooms/join", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message);
      router.push(`/aluno/minigames/ludo/${data.room.id}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível entrar."); }
    finally { setBusy(""); }
  }
  async function respond(invitationId: string, accept: boolean) {
    setBusy(invitationId);
    try {
      const response = await fetch(`/api/student/minigames/ludo/invitations/${invitationId}/respond`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ accept, block: false }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message);
      if (accept) router.push(`/aluno/minigames/ludo/${data.room.id}`); else await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível responder."); }
    finally { setBusy(""); }
  }

  const active = rooms.filter(room => ["WAITING", "ACTIVE", "PAUSED"].includes(room.status));
  const history = rooms.filter(room => ["FINISHED", "CANCELLED"].includes(room.status));
  return <main className="mesh mobile-safe min-h-screen"><div className="mx-auto max-w-6xl px-5 pb-24 sm:px-8">
    <header className="flex h-20 items-center justify-between border-b border-white/7"><div><p className="eyebrow">Mini games</p><strong className="font-display text-xl">Ludo Maker</strong></div><Link href="/aluno/minigames" className="button-secondary"><ArrowLeft size={17}/>Voltar</Link></header>
    <section className="mt-8 overflow-hidden rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-[#12283a] via-[#111d30] to-[#24152f] p-6 sm:p-9"><div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end"><div><p className="eyebrow">Circuito robótico</p><h1 className="mt-3 font-display text-4xl font-bold">Ludo <span className="text-cyan-300">Maker</span></h1><p className="mt-3 max-w-2xl text-slate-300">Leve seus quatro robôs da oficina até o núcleo central. Cada ação é validada pelo servidor e a partida pode ser retomada depois.</p></div><div className="flex gap-3"><Balance label="Seu saldo" value={`${student.devCoins} DC`} icon={CircleDollarSign}/><Balance label="Seu XP" value={`${student.xp} XP`} icon={Trophy}/></div></div></section>

    {error && <p role="alert" className="mt-5 rounded-xl border border-rose-400/25 bg-rose-400/10 p-4 text-sm text-rose-200">{error}</p>}
    {!realtimeReady && <p role="status" className="mt-5 rounded-xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-100">O modo em tempo real aguarda a configuração Redis. Em produção, novas salas ficam bloqueadas até essa conexão estar pronta.</p>}
    {invitations.length > 0 && <section className="glass mt-6 rounded-2xl p-5"><h2 className="flex items-center gap-2 font-display text-xl font-bold"><Radio className="text-fuchsia-300" size={20}/>Convites aguardando</h2><div className="mt-4 grid gap-3">{invitations.map(invite => <div key={invite.id} className="flex flex-col justify-between gap-3 rounded-xl border border-fuchsia-300/15 bg-fuchsia-300/5 p-4 sm:flex-row sm:items-center"><p className="text-sm"><strong>{invite.inviterName}</strong> chamou você para <strong>{invite.roomCode}</strong> · {invite.wager} DC por pessoa</p><div className="flex gap-2"><button disabled={Boolean(busy)} onClick={() => respond(invite.id, true)} className="button-primary">Aceitar</button><button disabled={Boolean(busy)} onClick={() => respond(invite.id, false)} className="button-secondary">Recusar</button></div></div>)}</div></section>}

    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <section className="glass rounded-2xl p-5 sm:p-6"><h2 className="flex items-center gap-2 font-display text-xl font-bold"><Plus size={20}/>Criar nova sala</h2><div className="mt-5 grid grid-cols-2 gap-2"><button className={`rounded-xl border p-4 text-left ${mode === "HUMAN" ? "border-cyan-300/50 bg-cyan-300/10" : "border-slate-700"}`} onClick={() => setMode("HUMAN")}><Swords className="text-cyan-300"/><strong className="mt-3 block">Com alunos</strong><span className="mt-1 block text-xs text-slate-400">2 a 4 pessoas</span></button><button className={`rounded-xl border p-4 text-left ${mode === "BOT" ? "border-fuchsia-300/50 bg-fuchsia-300/10" : "border-slate-700"}`} onClick={() => setMode("BOT")}><Bot className="text-fuchsia-300"/><strong className="mt-3 block">Contra a IA</strong><span className="mt-1 block text-xs text-slate-400">Aposta fixa: 50 DC</span></button></div>{mode === "HUMAN" && <label className="mt-5 block text-sm font-semibold">Aposta por jogador: <span className="text-amber-300">{wager} DC</span><input className="mt-3 w-full accent-cyan-400" type="range" min="10" max="100" step="10" value={wager} onChange={event => setWager(Number(event.target.value))}/><span className="flex justify-between text-xs text-slate-500"><span>10 DC</span><span>100 DC</span></span></label>}<div className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/8 p-4 text-xs leading-relaxed text-amber-100"><strong>Custo ao abrir:</strong> 50 DC não reembolsáveis para o caixa. A aposta fica bloqueada. Os 100 XP do criador só são descontados se a partida começar.{mode === "BOT" && " A IA também coloca 50 DC do caixa."}</div>{mode === "BOT" && <p className="mt-3 flex gap-2 rounded-xl border border-fuchsia-300/20 bg-fuchsia-300/8 p-4 text-xs text-fuchsia-100"><AlertTriangle className="shrink-0" size={17}/><span><strong>Há mais chances da IA do professor ganhar.</strong> Seus sorteios favorecem jogadas competitivas, com meta aproximada de 80% de vitórias da IA.</span></p>}<button disabled={Boolean(busy)} onClick={createRoom} className="button-primary mt-5 w-full">{busy === "create" ? <LoaderCircle className="animate-spin" size={18}/> : <Plus size={18}/>}Abrir sala</button></section>
      <section className="glass rounded-2xl p-5 sm:p-6"><h2 className="flex items-center gap-2 font-display text-xl font-bold"><DoorOpen size={20}/>Entrar com código</h2><p className="mt-2 text-sm text-slate-400">Peça ao dono o código de seis caracteres ou use o link compartilhado.</p><input aria-label="Código da sala" maxLength={6} value={code} onChange={event => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} placeholder="ABC123" className="mt-5 w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-4 text-center font-mono text-2xl font-bold tracking-[.35em] outline-none focus:border-cyan-400"/><button disabled={Boolean(busy) || code.length !== 6} onClick={joinRoom} className="button-secondary mt-3 w-full">{busy === "join" ? <LoaderCircle className="animate-spin" size={18}/> : <Play size={18}/>}Entrar na sala</button></section>
    </div>

    <Rules/>
    <section className="glass mt-6 rounded-2xl p-5 sm:p-6"><h2 className="flex items-center gap-2 font-display text-xl font-bold"><Clock3 size={20}/>Partidas para continuar</h2>{!loaded ? <LoaderCircle className="mt-5 animate-spin text-cyan-300"/> : active.length ? <div className="mt-4 grid gap-3 md:grid-cols-2">{active.map(room => <Link key={room.id} href={`/aluno/minigames/ludo/${room.id}`} className="rounded-xl border border-slate-700 bg-slate-950/30 p-4 transition hover:border-cyan-400/40"><div className="flex justify-between"><strong className="font-mono text-cyan-200">{room.code}</strong><Status value={room.status}/></div><p className="mt-2 text-sm">{room.players.length} jogador(es) · {room.wager} DC · {room.mode === "BOT" ? "contra IA" : "alunos"}</p></Link>)}</div> : <p className="mt-4 text-sm text-slate-500">Nenhuma partida aguardando ou pausada.</p>}</section>
    {history.length > 0 && <section className="glass mt-6 rounded-2xl p-5 sm:p-6"><h2 className="flex items-center gap-2 font-display text-xl font-bold"><History size={20}/>Histórico</h2><div className="mt-4 divide-y divide-slate-800">{history.map(room => <Link key={room.id} href={`/aluno/minigames/ludo/${room.id}`} className="flex items-center justify-between py-4 text-sm"><span><strong>{room.code}</strong> · {room.players.length} jogadores · {room.wager} DC</span><Status value={room.status}/></Link>)}</div></section>}
  </div></main>;
}

function Balance({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Trophy }) { return <div className="rounded-xl border border-white/10 bg-white/5 p-3"><Icon className="text-cyan-300" size={17}/><span className="mt-2 block text-[10px] uppercase tracking-wide text-slate-500">{label}</span><strong>{value}</strong></div>; }
function Status({ value }: { value: string }) { const labels: Record<string, string> = { WAITING: "Aguardando", ACTIVE: "Em jogo", PAUSED: "Pausada", FINISHED: "Finalizada", CANCELLED: "Cancelada" }; return <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] font-bold uppercase text-slate-300">{labels[value] ?? value}</span>; }
function Rules() { return <section className="mt-6 rounded-2xl border border-cyan-300/15 bg-[#101b2b]/80 p-5 sm:p-6"><h2 className="flex items-center gap-2 font-display text-xl font-bold"><ShieldCheck className="text-emerald-300" size={20}/>Regras financeiras e de permanência</h2><div className="mt-5 grid gap-3 text-sm md:grid-cols-2"><Rule title="Prêmios"><strong>2 jogadores:</strong> 80% ao 1º e 20% ao caixa. <strong>3 ou 4:</strong> 60% ao 1º, 20% ao 2º e o restante ao caixa. Frações são arredondadas para baixo e a sobra fica no caixa.</Rule><Rule title="XP por colocação">O último perde 100 XP. Com quatro jogadores, o 3º ganha 50 XP. Em todos os outros lugares não há alteração de XP por colocação.</Rule><Rule title="Desistência">Desistir desconta mais 100 XP. Após três minutos fora do site, ocorre desistência automática. Durante esse prazo, um robô realiza jogadas aleatórias e o aluno reassume ao voltar.</Rule><Rule title="Tempo e pausa">Há 10 segundos para sortear e 10 para escolher uma peça; depois a jogada é automática. O dono pausa quando quiser. Em duelo de dois alunos, três pedidos também pausam automaticamente.</Rule></div></section>; }
function Rule({ title, children }: { title: string; children: React.ReactNode }) { return <div className="rounded-xl bg-white/[.035] p-4"><strong className="text-cyan-200">{title}</strong><p className="mt-2 text-xs leading-relaxed text-slate-300">{children}</p></div>; }
