"use client";

import { useState } from "react";
import { Check, Copy, KeyRound, RefreshCw, X } from "lucide-react";

function randomCode() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return String(values[0] % 1_000_000).padStart(6, "0");
}

export function XpGrantCodeDialog() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ code: string; reason: string } | null>(null);
  const [copied, setCopied] = useState(false);

  function show() {
    setCode(randomCode());
    setReason("");
    setPassword("");
    setError("");
    setCreated(null);
    setOpen(true);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/professor/xp-grant-codes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, reason, teacherPassword: password }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setError(data.message ?? "Não foi possível criar o código.");
    setCreated({ code: data.grantCode.code, reason: data.grantCode.reason });
    setPassword("");
  }

  async function copyEndpoint() {
    if (!created) return;
    await navigator.clipboard.writeText(`${window.location.origin}/api/add-xp/${created.code}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return <>
    <button type="button" onClick={show} className="button-secondary"><KeyRound size={17}/>Criar código de XP</button>
    {open && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="xp-code-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div className="glass w-full max-w-xl rounded-3xl p-6 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4"><div><p className="eyebrow">Integração externa</p><h2 id="xp-code-title" className="mt-2 font-display text-2xl font-bold">Código para adicionar XP</h2></div><button type="button" onClick={() => setOpen(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Fechar"><X size={20}/></button></div>
        {created ? <div className="mt-6">
          <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-5"><p className="flex items-center gap-2 font-bold text-emerald-200"><Check size={18}/>Código criado</p><p className="mt-3 font-mono text-3xl font-black tracking-[.2em] text-white">{created.code}</p><p className="mt-2 text-sm text-slate-300">Motivo gravado no histórico: {created.reason}</p></div>
          <p className="mt-5 text-sm font-bold text-slate-200">Endpoint POST</p><code className="mt-2 block overflow-x-auto rounded-xl bg-slate-950 p-3 text-sm text-blue-200">/api/add-xp/{created.code}</code>
          <p className="mt-4 text-sm font-bold text-slate-200">JSON</p><code className="mt-2 block overflow-x-auto rounded-xl bg-slate-950 p-3 text-sm text-blue-200">{`{ "usdente": "AL2026001", "xp": 100 }`}</code>
          <button type="button" onClick={copyEndpoint} className="button-secondary mt-5">{copied ? <Check size={17}/> : <Copy size={17}/>} {copied ? "Copiado" : "Copiar endpoint completo"}</button>
        </div> : <form onSubmit={submit} className="mt-6 space-y-5">
          <label className="block text-sm font-bold">Código numérico de 6 dígitos<div className="mt-2 flex gap-2"><input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} className="input font-mono text-lg tracking-[.18em]"/><button type="button" onClick={() => setCode(randomCode())} className="button-secondary shrink-0" aria-label="Gerar outro código"><RefreshCw size={17}/></button></div></label>
          <label className="block text-sm font-bold">Motivo do ganho de XP<textarea required minLength={3} maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} className="input mt-2 min-h-24 resize-y" placeholder="Ex.: Participação na feira de ciências"/></label>
          <label className="block text-sm font-bold">Senha do professor<input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="input mt-2" placeholder="Confirme com sua senha"/></label>
          <p className="text-xs leading-relaxed text-slate-400">Cada aluno pode receber XP apenas uma vez com este código. O valor é informado pela integração no momento da chamada.</p>
          {error && <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>}
          <button disabled={busy || !/^\d{6}$/.test(code) || reason.trim().length < 3 || !password} className="button-primary w-full justify-center disabled:opacity-50">{busy ? "Criando…" : "Criar código"}</button>
        </form>}
      </div>
    </div>}
  </>;
}
