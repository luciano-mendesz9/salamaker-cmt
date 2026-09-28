"use client";

import { Power, Store } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function StickerMarketControl({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      const response = await fetch("/api/professor/stickers/market", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: !enabled }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setEnabled(data.enabled);
      toast.success(data.enabled ? "Compras e vendas ativadas." : "Compras e vendas desativadas.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível alterar o mercado.");
    } finally {
      setBusy(false);
    }
  }

  return <section className={`mb-6 rounded-2xl border p-5 ${enabled ? "border-emerald-400/25 bg-emerald-400/8" : "border-amber-400/25 bg-amber-400/8"}`}>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${enabled ? "bg-emerald-400/15 text-emerald-300" : "bg-amber-400/15 text-amber-200"}`}><Store /></span>
      <div className="mr-auto">
        <p className="eyebrow">Mercado entre alunos</p>
        <h2 className="mt-1 font-display text-xl font-bold">Compras e vendas {enabled ? "ativadas" : "desativadas"}</h2>
        <p className="mt-1 text-sm text-slate-300">{enabled ? "Alunos podem anunciar duplicatas e comprar anúncios." : "Novos anúncios e compras estão bloqueados. Anúncios existentes ainda podem ser cancelados."}</p>
      </div>
      <button type="button" aria-pressed={enabled} disabled={busy} onClick={toggle} className={enabled ? "button-secondary border-rose-400/30 text-rose-200" : "button-primary"}>
        <Power size={17}/>{busy ? "Salvando…" : enabled ? "Desativar compras e vendas" : "Ativar compras e vendas"}
      </button>
    </div>
  </section>;
}
