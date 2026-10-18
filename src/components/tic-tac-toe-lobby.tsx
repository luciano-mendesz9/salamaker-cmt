"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Coins, Copy, Hash, RotateCcw, Smartphone, Trophy, Users, Wifi } from "lucide-react";
import { toast } from "sonner";
import { Brand } from "@/components/brand";
import { LogoutButton } from "@/components/logout-button";
import { applyTicTacToeMove, TIC_TAC_TOE_MAX_WAGER, TIC_TAC_TOE_MIN_WAGER, ticTacToeFinished, ticTacToeSettlement, ticTacToeWinner, type TicTacToeMark } from "@/lib/tic-tac-toe-rules";

type Lobby = { gamesEnabled: boolean; currentRoom: { id: string; code: string; status: string } | null; devCoins: number };
type Mode = "menu" | "machine" | "local" | "multiplayer";

export function TicTacToeLobby({ initial, studentName }: { initial: Lobby; studentName: string }) {
  const [mode, setMode] = useState<Mode>("menu");
  return <main className="mesh min-h-screen"><div className="mx-auto max-w-6xl px-4 pb-20 sm:px-8">
    <header className="flex h-20 items-center justify-between border-b border-white/7"><Brand context="Jogo da velha"/><div className="flex items-center gap-2"><Link href="/aluno/minigames" className="button-secondary py-2 text-sm">Vitrine</Link><LogoutButton/></div></header>
    {mode === "menu" && <><section className="mt-8 rounded-3xl border border-fuchsia-300/20 bg-gradient-to-br from-[#23102e] via-[#11182a] to-[#071a24] p-6 sm:p-9"><p className="eyebrow">X, O e estratégia</p><h1 className="mt-3 font-display text-3xl font-black sm:text-5xl">Como você quer jogar?</h1><p className="mt-3 text-sm text-slate-300">Escolha um modo. Partidas locais e contra a máquina são totalmente grátis; no multiplayer, a sala é grátis e só a aposta é debitada.</p></section><section className="mt-6 grid gap-4 md:grid-cols-3"><ModeCard icon={Bot} title="Contra a máquina" text="Enfrente um algoritmo que calcula todas as respostas e nunca entrega uma vitória fácil." action={() => setMode("machine")}/><ModeCard icon={Smartphone} title="2 no mesmo celular" text="Passe o aparelho. X e O se alternam na mesma tela, sem aposta e sem internet." action={() => setMode("local")}/><ModeCard icon={Wifi} title="Multiplayer online" text="Crie uma sala com aposta ou entre com um código. Vitória vale 25 XP e 85% do pote." action={() => setMode("multiplayer")}/></section></>}
    {mode === "machine" && <MachineTicTacToe onBack={() => setMode("menu")}/>}
    {mode === "local" && <LocalTicTacToe onBack={() => setMode("menu")}/>}
    {mode === "multiplayer" && (
      <MultiplayerLobby initial={initial} studentName={studentName} onBack={() => setMode("menu")}/>
    )}
  </div></main>;
}

function ModeCard({ icon: Icon, title, text, action }: { icon: typeof Bot; title: string; text: string; action: () => void }) { return <button onClick={action} className="glass group rounded-3xl border border-white/8 p-6 text-left transition hover:-translate-y-1 hover:border-fuchsia-300/40"><Icon className="text-fuchsia-300" size={30}/><h2 className="mt-5 font-display text-xl font-black">{title}</h2><p className="mt-2 min-h-16 text-sm leading-relaxed text-slate-400">{text}</p><span className="mt-5 inline-flex font-bold text-fuchsia-200">Escolher →</span></button>; }

type SoloGame = { id: string; board: string; status: "ACTIVE" | "FINISHED"; result: "HUMAN_WIN" | "MACHINE_WIN" | "DRAW" | null; xpReward: number; fullXpMatches: number };

function MachineTicTacToe({ onBack }: { onBack: () => void }) {
  const [game, setGame] = useState<SoloGame | null>(null);
  const [busy, setBusy] = useState(true);
  async function create() {
    setBusy(true);
    try {
      const response = await fetch("/api/student/minigames/tic-tac-toe/solo/games", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requestId: crypto.randomUUID() }) });
      const data = await response.json();
      if (!response.ok) return toast.error(data.message);
      setGame(data.game);
    } finally { setBusy(false); }
  }
  useEffect(() => {
    let active = true;
    void fetch("/api/student/minigames/tic-tac-toe/solo/games", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requestId: crypto.randomUUID() }) })
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => { if (!active) return; if (!response.ok) toast.error(data.message); else setGame(data.game); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);
  async function play(cell: number) {
    if (!game || busy || game.status !== "ACTIVE" || game.board[cell] !== "-") return;
    setBusy(true);
    try {
      const response = await fetch(`/api/student/minigames/tic-tac-toe/solo/games/${game.id}/moves`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cell, requestId: crypto.randomUUID() }) });
      const data = await response.json();
      if (!response.ok) return toast.error(data.message);
      setGame(data.game);
    } finally { setBusy(false); }
  }
  const message = !game ? "Preparando partida…" : game.status === "ACTIVE" ? busy ? "A máquina está pensando…" : "Sua vez — você é X" : game.result === "HUMAN_WIN" ? `Você venceu! +${game.xpReward} XP` : game.result === "MACHINE_WIN" ? "A máquina venceu. Tente outra estratégia!" : "Deu velha!";
  return <section className="mx-auto mt-8 max-w-xl"><button onClick={onBack} className="text-sm font-bold text-slate-400">← Trocar modo</button><div className="glass mt-5 rounded-3xl p-5 text-center sm:p-8"><div className="mx-auto flex w-fit items-center gap-3 rounded-full bg-fuchsia-300/10 px-4 py-2 text-sm font-bold text-fuchsia-200"><Bot size={18}/> Você contra a máquina</div><h1 className="mt-5 font-display text-2xl font-black">{message}</h1><p className="mt-2 text-xs text-slate-400">Vitórias nas primeiras 5 partidas do dia valem 25 XP. Da 6ª em diante, valem 15 XP, sem limite de partidas.</p><TicBoard board={game?.board ?? "---------"} disabled={busy || !game || game.status !== "ACTIVE"} onPlay={play}/><div className="mt-6 flex gap-3"><button onClick={onBack} className="button-secondary flex-1 justify-center">Voltar</button><button disabled={busy || game?.status === "ACTIVE"} onClick={create} className="button-primary flex-1"><RotateCcw size={18}/>Nova rodada</button></div></div></section>;
}

function LocalTicTacToe({ onBack }: { onBack: () => void }) {
  const [board, setBoard] = useState("---------"); const [next, setNext] = useState<TicTacToeMark>("X"); const winner = ticTacToeWinner(board); const finished = ticTacToeFinished(board);
  function play(cell: number) { if (finished || board[cell] !== "-") return; setBoard(applyTicTacToeMove(board, cell, next)); setNext(next === "X" ? "O" : "X"); }
  function reset() { setBoard("---------"); setNext("X"); }
  const message = winner ? `${winner} venceu!` : finished ? "Deu velha!" : `Vez de ${next}`;
  return <section className="mx-auto mt-8 max-w-xl"><button onClick={onBack} className="text-sm font-bold text-slate-400">← Trocar modo</button><div className="glass mt-5 rounded-3xl p-5 text-center sm:p-8"><div className="mx-auto flex w-fit items-center gap-3 rounded-full bg-fuchsia-300/10 px-4 py-2 text-sm font-bold text-fuchsia-200"><Users size={18}/> Dois jogadores locais</div><h1 className="mt-5 font-display text-2xl font-black">{message}</h1><TicBoard board={board} disabled={finished} onPlay={play}/><div className="mt-6 flex gap-3"><button onClick={onBack} className="button-secondary flex-1 justify-center">Voltar</button><button onClick={reset} className="button-primary flex-1"><RotateCcw size={18}/>Nova rodada</button></div></div></section>;
}

function MultiplayerLobby({ initial, studentName, onBack }: { initial: Lobby; studentName: string; onBack: () => void }) {
  const router = useRouter(); const [wager, setWager] = useState(TIC_TAC_TOE_MIN_WAGER); const [code, setCode] = useState(""); const [busy, setBusy] = useState(false); const validWager = Number.isInteger(wager) && wager >= TIC_TAC_TOE_MIN_WAGER && wager <= TIC_TAC_TOE_MAX_WAGER; const settlement = ticTacToeSettlement(validWager ? wager : TIC_TAC_TOE_MIN_WAGER);
  async function create() { setBusy(true); try { const response = await fetch("/api/student/minigames/tic-tac-toe/rooms", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ wager, requestId: crypto.randomUUID() }) }); const data = await response.json(); if (!response.ok) return toast.error(data.message); router.push(`/aluno/minigames/jogo-da-velha/${data.room.id}`); } finally { setBusy(false); } }
  async function join() { setBusy(true); try { const response = await fetch("/api/student/minigames/tic-tac-toe/rooms/join", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) }); const data = await response.json(); if (!response.ok) return toast.error(data.message); router.push(`/aluno/minigames/jogo-da-velha/${data.room.id}`); } finally { setBusy(false); } }
  return <section className="mt-8"><button onClick={onBack} className="text-sm font-bold text-slate-400">← Trocar modo</button><div className="mt-5 rounded-3xl border border-fuchsia-300/20 bg-gradient-to-r from-[#21102c] to-[#0c1c2c] p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">Multiplayer em tempo real</p><h1 className="mt-2 font-display text-3xl font-black">Sala de {studentName}</h1><p className="mt-2 text-sm text-slate-300">Crie grátis ou entre pelo código. Empates devolvem integralmente as duas apostas.</p></div><div className="rounded-2xl bg-amber-300/10 px-5 py-3 text-right"><p className="text-xs text-slate-400">Seu saldo</p><strong className="text-xl text-amber-200">{initial.devCoins} DC</strong></div></div></div>
  {initial.currentRoom ? <div className="glass mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5"><div><strong>Sala {initial.currentRoom.code}</strong><p className="text-sm text-slate-400">Você já tem uma partida {initial.currentRoom.status === "ACTIVE" ? "em andamento" : "aguardando rival"}.</p></div><Link className="button-primary" href={`/aluno/minigames/jogo-da-velha/${initial.currentRoom.id}`}>Abrir sala</Link></div> : <div className="mt-5 grid gap-5 lg:grid-cols-2"><div className="glass rounded-3xl p-6"><div className="flex items-center gap-2 text-fuchsia-300"><Coins size={20}/><p className="eyebrow !text-fuchsia-300">Criar sala grátis</p></div><label className="mt-5 block text-sm font-bold">Aposta de cada jogador<input className="input mt-2" type="number" min={TIC_TAC_TOE_MIN_WAGER} max={TIC_TAC_TOE_MAX_WAGER} value={wager} onChange={(event) => setWager(Number(event.target.value))}/></label><input className="mt-3 w-full accent-fuchsia-400" type="range" min={TIC_TAC_TOE_MIN_WAGER} max={TIC_TAC_TOE_MAX_WAGER} value={wager} onChange={(event) => setWager(Number(event.target.value))}/><div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs"><Stat label="Pote" value={`${settlement.total} DC`}/><Stat label="Vencedor" value={`${settlement.winnerPayout} DC`}/><Stat label="Caixa" value={`${settlement.taxAmount} DC`}/></div><button disabled={busy || initial.devCoins < wager || !validWager} onClick={create} className="button-primary mt-5 w-full">{busy ? "Aguarde…" : "Criar e gerar código"}</button></div>
  <div className="glass rounded-3xl p-6"><div className="flex items-center gap-2 text-cyan-300"><Hash size={20}/><p className="eyebrow !text-cyan-300">Entrar em uma sala</p></div><p className="mt-4 text-sm leading-relaxed text-slate-400">A aposta definida pelo criador será debitada dos dois jogadores assim que você entrar.</p><label className="mt-6 block text-sm font-bold">Código de 6 dígitos<input inputMode="numeric" maxLength={6} className="input mt-2 font-mono text-2xl tracking-[.3em]" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000"/></label><button disabled={busy || code.length !== 6} onClick={join} className="button-secondary mt-5 w-full justify-center">Entrar na partida</button></div></div>}
  <div className="mt-5 grid gap-3 sm:grid-cols-3"><SmallRule icon={Trophy} title="25 XP" text="para quem vencer"/><SmallRule icon={Coins} title="85% do pote" text="vai para o vencedor"/><SmallRule icon={Copy} title="Revanche" text="mesma sala e aposta"/></div></section>;
}

export function TicBoard({ board, disabled, onPlay }: { board: string; disabled: boolean; onPlay: (cell: number) => void }) { return <div className="mx-auto mt-6 grid aspect-square w-full max-w-sm grid-cols-3 gap-2 rounded-3xl bg-white/5 p-2">{[...board].map((value, index) => <button key={index} aria-label={`Casa ${index + 1}${value === "-" ? " vazia" : ` com ${value}`}`} disabled={disabled || value !== "-"} onClick={() => onPlay(index)} className={`rounded-2xl border border-white/8 bg-[#0d1726] font-display text-5xl font-black transition active:scale-95 sm:text-6xl ${value === "X" ? "text-cyan-300" : value === "O" ? "text-fuchsia-300" : "hover:bg-white/10"}`}>{value === "-" ? "" : value}</button>)}</div>; }
function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-white/5 p-3"><p className="text-slate-500">{label}</p><strong className="mt-1 block text-fuchsia-200">{value}</strong></div>; }
function SmallRule({ icon: Icon, title, text }: { icon: typeof Trophy; title: string; text: string }) { return <div className="glass flex items-center gap-3 rounded-2xl p-4"><Icon className="text-fuchsia-300" size={20}/><div><strong className="text-sm">{title}</strong><p className="text-xs text-slate-500">{text}</p></div></div>; }
