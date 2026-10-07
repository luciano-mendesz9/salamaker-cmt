"use client";

import { useState } from "react";
import { CheckCircle2, KeyRound } from "lucide-react";
import { toast } from "sonner";

export function PresenceForm() {
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    setBusy(true);
    try {
      const response = await fetch("/api/presence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accessCode: fields.get("accessCode"), lessonCode: fields.get("lessonCode") }),
      });
      const data = await response.json().catch(() => ({ message: "O servidor retornou uma resposta inválida." }));
      if (response.ok) {
        toast.success(data.message);
        form.reset();
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error("Não foi possível conectar ao servidor. Verifique a internet e tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="mt-6 space-y-5">
    <label className="block text-sm font-bold">Código do aluno<input name="accessCode" disabled={busy} className="input mt-2 uppercase" placeholder="AL2026001" required/></label>
    <label className="block text-sm font-bold">Código da aula<span className="relative mt-2 block"><input name="lessonCode" disabled={busy} className="input pr-12 tracking-[.3em]" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} placeholder="000000" required/><KeyRound className="absolute right-4 top-4 text-slate-500" size={19}/></span></label>
    <button disabled={busy} className="button-primary w-full py-4"><CheckCircle2 size={20}/>{busy ? "Aguarde..." : "Confirmar presença"}</button>
  </form>;
}
