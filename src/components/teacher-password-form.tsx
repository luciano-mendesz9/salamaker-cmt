"use client";

import { useState } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export function TeacherPasswordForm() {
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    try {
      const response = await fetch("/api/professor/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          currentPassword: data.get("currentPassword"),
          newPassword: data.get("newPassword"),
          confirmation: data.get("confirmation"),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success("Senha alterada. Entre novamente com a nova senha.");
      window.location.assign(result.redirectTo ?? "/login");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível alterar a senha.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,.65fr)]">
    <form onSubmit={submit} className="glass rounded-3xl p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-blue-400/10 text-blue-300"><KeyRound aria-hidden="true"/></span>
        <div><p className="eyebrow">Segurança da conta</p><h2 className="mt-2 font-display text-2xl font-bold">Trocar minha senha</h2><p className="mt-2 text-sm text-slate-400">Confirme sua senha atual e escolha uma nova senha com 8 a 72 caracteres.</p></div>
      </div>
      <label className="mt-7 block text-sm font-bold">Senha atual<input className="input mt-2" name="currentPassword" type="password" autoComplete="current-password" required autoFocus/></label>
      <label className="mt-5 block text-sm font-bold">Nova senha<input className="input mt-2" name="newPassword" type="password" minLength={8} maxLength={72} autoComplete="new-password" required/></label>
      <label className="mt-5 block text-sm font-bold">Confirmar nova senha<input className="input mt-2" name="confirmation" type="password" minLength={8} maxLength={72} autoComplete="new-password" required/></label>
      <button className="button-primary mt-7" disabled={busy}>{busy ? "Alterando…" : "Alterar senha"}</button>
    </form>
    <aside className="rounded-3xl border border-emerald-400/20 bg-emerald-400/5 p-6">
      <ShieldCheck className="text-emerald-300" size={30} aria-hidden="true"/>
      <h2 className="mt-4 font-display text-xl font-bold">O que acontece depois?</h2>
      <p className="mt-3 text-sm leading-6 text-slate-300">Por segurança, todas as sessões abertas desta conta serão encerradas. Você entrará novamente usando a nova senha.</p>
    </aside>
  </div>;
}
