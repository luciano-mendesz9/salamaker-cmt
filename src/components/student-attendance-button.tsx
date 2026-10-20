"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ClipboardCheck, X } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function StudentAttendanceButton() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) setOpen(false); };
    document.addEventListener("keydown", closeOnEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", closeOnEscape); document.body.style.overflow = previousOverflow; };
  }, [open, busy]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !/^\d{6}$/.test(code)) return;
    setBusy(true);
    try {
      const response = await fetch("/api/student/presence", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lessonCode: code }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message ?? "Não foi possível marcar sua presença.");
      toast.success(data.message);
      setOpen(false);
      setVisible(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível marcar sua presença.");
    } finally {
      setBusy(false);
    }
  }

  if (!visible) return null;
  return <>
    <button type="button" onClick={() => setOpen(true)} className="focus-ring mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 font-bold text-white shadow-lg shadow-emerald-950/25 transition hover:bg-emerald-400"><ClipboardCheck size={19}/>Marcar Presença</button>
    {open && <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-slate-950/85 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="student-attendance-title" className="glass my-6 w-full max-w-md rounded-3xl p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4"><div><p className="eyebrow text-emerald-300">Aula em andamento</p><h2 id="student-attendance-title" className="mt-2 font-display text-2xl font-bold">Marcar Presença</h2></div><button type="button" disabled={busy} onClick={() => setOpen(false)} className="focus-ring rounded-xl border border-slate-700 p-2 text-slate-300" aria-label="Fechar"><X size={20}/></button></div>
        <p className="mt-4 text-sm leading-6 text-slate-300">Digite o código de seis números informado pelo professor. A presença será registrada para a sua conta.</p>
        <form onSubmit={submit} className="mt-5"><label className="block text-sm font-bold"><span className="mb-2 block">Código da aula</span><input autoFocus value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} className="input text-center font-mono text-2xl font-bold tracking-[.3em]" inputMode="numeric" autoComplete="one-time-code" placeholder="000000" maxLength={6} required /></label><button disabled={busy || !/^\d{6}$/.test(code)} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 font-bold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"><CheckCircle2 size={18}/>{busy ? "Confirmando..." : "Confirmar presença"}</button></form>
      </section>
    </div>}
  </>;
}
