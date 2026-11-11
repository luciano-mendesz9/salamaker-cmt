"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ComplaintRevokeForm({ complaintId }: { complaintId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch(`/api/professor/complaints/${complaintId}/revoke`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
      const data = await response.json();
      if (!response.ok) { setError(data.message ?? "Não foi possível revogar."); return; }
      router.refresh();
    } catch { setError("A conexão falhou. Tente novamente."); }
    finally { setBusy(false); }
  }

  return <form onSubmit={submit} className="mt-4 flex flex-col gap-2 border-t border-[var(--line)] pt-4 sm:flex-row sm:items-end"><label className="min-w-0 flex-1 text-sm font-semibold">Justificativa da revogação<input required minLength={5} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} className="input mt-2" placeholder="Explique por que este registro não deve contar"/></label><button disabled={busy} className="button-secondary min-h-11 whitespace-nowrap disabled:opacity-50">{busy ? "Revogando…" : "Revogar reclamação"}</button>{error&&<p role="alert" className="text-sm text-rose-300 sm:basis-full">{error}</p>}</form>;
}
