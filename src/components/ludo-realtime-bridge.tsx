"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, ShieldX, Swords, X } from "lucide-react";

type Invite = { invitationId: string; roomCode: string; inviterName: string; wager: number; expiresAt: string };

export function LudoRealtimeBridge() {
  const router = useRouter();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [busy, setBusy] = useState(false);
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let closed = false;
    let socket: WebSocket | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    const connect = () => {
      if (closed) return;
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${protocol}//${location.host}/api/student/minigames/ludo/ws`);
      socket.addEventListener("open", () => {
        heartbeat = setInterval(() => socket?.readyState === WebSocket.OPEN && socket.send(JSON.stringify({ type: "heartbeat" })), 20_000);
      });
      socket.addEventListener("message", event => {
        try {
          const message = JSON.parse(event.data) as { type?: string; payload?: Invite };
          if (message.type === "invitation" && message.payload?.invitationId) setInvite(message.payload);
          window.dispatchEvent(new CustomEvent("ludo-realtime", { detail: message }));
        } catch { /* ignora quadros inválidos */ }
      });
      socket.addEventListener("close", () => {
        if (heartbeat) clearInterval(heartbeat);
        retry.current = setTimeout(connect, 2_000);
      });
    };
    connect();
    return () => { closed = true; if (retry.current) clearTimeout(retry.current); if (heartbeat) clearInterval(heartbeat); socket?.close(); };
  }, []);

  async function respond(accept: boolean, block = false) {
    if (!invite) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/student/minigames/ludo/invitations/${invite.invitationId}/respond`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ accept, block }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Não foi possível responder.");
      setInvite(null);
      if (accept && data.room?.id) router.push(`/aluno/minigames/ludo/${data.room.id}`);
    } catch (error) { alert(error instanceof Error ? error.message : "Não foi possível responder."); }
    finally { setBusy(false); }
  }

  if (!invite) return null;
  return <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/80 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="ludo-invite-title">
    <section className="relative w-full max-w-md overflow-hidden rounded-3xl border border-cyan-300/30 bg-[#111d2f] p-6 shadow-2xl shadow-cyan-950/50">
      <button className="focus-ring absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-white/10" onClick={() => setInvite(null)} aria-label="Fechar convite"><X size={18}/></button>
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-cyan-400/15 text-cyan-300"><Bot size={30}/></div>
      <p className="eyebrow mt-5">Convite em tempo real</p>
      <h2 id="ludo-invite-title" className="mt-2 font-display text-2xl font-bold">Partiu Ludo Maker?</h2>
      <p className="mt-3 text-sm text-slate-300"><strong>{invite.inviterName}</strong> convidou você para a sala <strong>{invite.roomCode}</strong>. A aposta bloqueada será de <strong>{invite.wager} DC</strong>.</p>
      <p className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/8 p-3 text-xs text-amber-100">Você só entrará se tiver saldo suficiente. Recusar não desconta Dev-Coins.</p>
      <div className="mt-5 grid gap-2 sm:grid-cols-2"><button disabled={busy} className="button-primary" onClick={() => respond(true)}><Swords size={17}/>Aceitar e jogar</button><button disabled={busy} className="button-secondary" onClick={() => respond(false)}>Agora não</button></div>
      <button disabled={busy} className="mt-3 flex w-full items-center justify-center gap-2 text-xs text-slate-400 hover:text-rose-300" onClick={() => respond(false, true)}><ShieldX size={15}/>Recusar e bloquear convites desta pessoa por 10 minutos</button>
    </section>
  </div>;
}
