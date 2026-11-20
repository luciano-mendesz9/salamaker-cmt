"use client";

import { useState } from "react";
import { Power, Save, Server } from "lucide-react";

type Settings = { enabled: boolean; version: string; origin: string };

export function BrexSettingsForm({ initial, schemaReady }: { initial: Settings; schemaReady: boolean }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/professor/brex-ai", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, origin: form.origin.trim() || null }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Não foi possível salvar.");
      setForm({ enabled: result.settings.enabled, version: result.settings.version, origin: result.settings.origin ?? "" });
      setMessage("Configuração salva.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível salvar."); }
    finally { setSaving(false); }
  }
  return <form onSubmit={save} className="glass space-y-6 rounded-3xl p-5 sm:p-7">
    {!schemaReady && <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">A migration do Brex AI precisa ser aplicada ao banco antes de salvar.</p>}
    <label className="block"><span className="mb-2 block text-sm font-bold">Versão exibida aos alunos</span><input className="input" maxLength={40} value={form.version} onChange={event => setForm({ ...form, version: event.target.value })} placeholder="0.1.0" required/></label>
    <label className="block"><span className="mb-2 flex items-center gap-2 text-sm font-bold"><Server size={16}/>Domínio do servidor local</span><input className="input" value={form.origin} onChange={event => setForm({ ...form, origin: event.target.value })} placeholder="https://seu-dominio.ngrok-free.app" type="url"/><span className="mt-2 block text-xs text-slate-400">Informe somente o domínio HTTPS. O sistema acrescenta /ping e /v1/chat automaticamente.</span></label>
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4"><span className="flex items-center gap-3"><Power className="text-blue-300" size={20}/><span><strong className="block">Brex disponível</strong><small className="mt-1 block text-slate-400">Quando desligado, os alunos veem a tela de indisponibilidade.</small></span></span><input type="checkbox" checked={form.enabled} onChange={event => setForm({ ...form, enabled: event.target.checked })} className="h-5 w-5 accent-blue-500"/></label>
    <div className="flex items-center justify-between gap-3"><p role="status" className="text-sm text-slate-300">{message}</p><button type="submit" disabled={saving || !schemaReady} className="button-primary"><Save size={16}/>{saving ? "Salvando..." : "Salvar"}</button></div>
  </form>;
}
