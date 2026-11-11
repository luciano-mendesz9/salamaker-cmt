"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BarChart3, MessageSquareWarning, X } from "lucide-react";
import { nextComplaintCost } from "@/lib/student-complaint-policy";

type Student = { id: string; firstName: string; lastName: string };

export function StudentComplaintsCard({ days, ready, canFile, hasOpenLesson, lessonId, lessonTitle, students, complaintCounts, teacherComplaintFiled, devCoins }: { days: { label: string; count: number }[]; ready: boolean; canFile: boolean; hasOpenLesson: boolean; lessonId: string | null; lessonTitle: string | null; students: Student[]; complaintCounts: { studentId: string; count: number }[]; teacherComplaintFiled: boolean; devCoins: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const requestId = useRef<string | null>(null);
  const total = days.reduce((sum, day) => sum + day.count, 0);
  const highest = Math.max(1, ...days.map(day => day.count));
  const countByStudent = new Map(complaintCounts.map(item => [item.studentId, item.count]));
  const affordableStudent = students.find(student => { const next = nextComplaintCost("STUDENT", countByStudent.get(student.id) ?? 0); return next && next.fee <= devCoins; });
  const eligible = ready && canFile && Boolean(lessonId) && (!teacherComplaintFiled || Boolean(affordableStudent));
  const selectedCost = choice === "TEACHER" ? nextComplaintCost("TEACHER", teacherComplaintFiled ? 1 : 0) : choice ? nextComplaintCost("STUDENT", countByStudent.get(choice) ?? 0) : null;

  function openDialog() {
    setChoice(!teacherComplaintFiled ? "TEACHER" : affordableStudent?.id ?? "");
    setReason(""); setError(""); setFeedback(""); requestId.current = null; setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", onKey); };
  }, [open, busy]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    requestId.current ??= crypto.randomUUID();
    try {
      const target = choice === "TEACHER" ? { kind: "TEACHER" } : { kind: "STUDENT", studentId: choice };
      const response = await fetch("/api/student/complaints", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lessonId, target, reason, expectedFee: selectedCost?.fee, requestId: requestId.current }) });
      const data = await response.json();
      if (!response.ok) { setError(data.message ?? "Não foi possível enviar a reclamação."); return; }
      setFeedback(data.message ?? "Reclamação enviada ao professor.");
      setOpen(false); setChoice(""); setReason(""); requestId.current = null;
      router.refresh();
    } catch {
      setError("A conexão falhou. Tente enviar novamente.");
    } finally { setBusy(false); }
  }

  return <section className="student-card rounded-3xl p-5 sm:p-6" aria-labelledby="complaints-heading">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow">Acompanhamento da turma</p><h2 id="complaints-heading" className="mt-2 flex items-center gap-2 font-display text-xl font-bold"><BarChart3 size={21} className="text-[var(--accent-soft)]"/>Reclamações recebidas nesta semana</h2><p className="mt-2 text-sm text-[var(--muted)]">Registros sobre você, de segunda a domingo. Reclamações revogadas não entram na contagem.</p></div><strong className="font-display text-4xl font-black text-[var(--accent-soft)]">{ready ? total : "—"}</strong></div>
    {ready&&<div className="mt-5 grid h-32 grid-cols-7 items-end gap-2 border-b border-[var(--line)]" role="img" aria-label={`Gráfico de reclamações recebidas nesta semana: ${days.map(day => `${day.label} ${day.count}`).join(", ")}`}>
      {days.map((day, index) => <div key={index} className="flex h-full flex-col items-center justify-end gap-1"><span className="text-xs font-bold text-[var(--text)]">{day.count}</span><span className="w-full max-w-10 rounded-t-lg bg-[var(--accent)]" style={{ height: `${Math.max(4, day.count / highest * 90)}px`, opacity: day.count ? 1 : .3 }}/><span className="pb-1 text-[11px] text-[var(--muted)]">{day.label.replace(".", "")}</span></div>)}
    </div>}
    <div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={openDialog} disabled={!eligible} className="button-primary min-h-11 disabled:cursor-not-allowed disabled:opacity-50"><MessageSquareWarning size={17}/>Reclamar de Aluno</button><Link href="/aluno/reclamacoes/ranking" className="button-secondary min-h-11">Ranking de reclamações</Link></div>
    {!ready?<p className="mt-3 text-sm text-[var(--muted)]">Reclamações aguardam a atualização do banco de dados.</p>:!hasOpenLesson?<p className="mt-3 text-sm text-[var(--muted)]">Você poderá reclamar quando houver uma aula aberta e sua presença estiver marcada.</p>:!canFile?<p className="mt-3 text-sm text-[var(--muted)]">Marque sua presença na aula atual para liberar a reclamação.</p>:!eligible?<p className="mt-3 text-sm text-[var(--muted)]">Você já usou o envio gratuito ao professor e não há colegas disponíveis dentro do seu saldo e limite desta aula.</p>:null}
    {feedback&&<p role="status" className="mt-3 text-sm font-semibold text-[var(--accent-soft)]">{feedback}</p>}
    {open&&<div className="student-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setOpen(false); }}><section role="dialog" aria-modal="true" aria-labelledby="complaint-dialog-title" className="student-dialog max-w-xl p-5 sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">Aula atual</p><h2 id="complaint-dialog-title" className="mt-2 font-display text-2xl font-bold">Reclamar de Aluno</h2></div><button type="button" onClick={() => setOpen(false)} disabled={busy} className="student-icon-button" aria-label="Fechar"><X size={18}/></button></div>
      <form onSubmit={submit} className="mt-5 space-y-4"><label className="block text-sm font-semibold">Sobre quem é a reclamação?<select required autoFocus value={choice} onChange={event => { setChoice(event.target.value); requestId.current = null; }} className="input mt-2"><option value="TEACHER" disabled={teacherComplaintFiled}>RECLAMAÇÃO DO PROFESSOR</option>{students.map(student => { const next = nextComplaintCost("STUDENT", countByStudent.get(student.id) ?? 0); return <option key={student.id} value={student.id} disabled={!next || next.fee > devCoins}>{student.firstName} {student.lastName}{!next ? " · limite atingido" : ` · ${next.fee} DC`}</option>; })}</select></label>
        <p className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-sm text-[var(--text)]">Esta reclamação é sobre a aula atual: <strong>{lessonTitle}</strong>.</p>
        <label className="block text-sm font-semibold">Motivo da reclamação<textarea required minLength={10} maxLength={2000} rows={5} value={reason} onChange={event => { setReason(event.target.value); requestId.current = null; }} className="input mt-2 resize-y" placeholder="Descreva o que aconteceu nesta aula."/></label>
        <p className="text-sm text-[var(--muted)]">{choice === "TEACHER" ? "Esta reclamação é sobre o professor da aula atual. Você pode enviar uma por aula, sem custo." : `Esta será sua ${selectedCost?.ordinal ?? "—"}ª reclamação sobre esse aluno nesta aula. Custo: ${selectedCost?.fee ?? "—"} Dev-Coins. O limite é de três.`} Só o professor verá seu nome e o motivo. Reclamações revogadas continuam no histórico e taxas pagas não são devolvidas.</p>
        {error&&<p role="alert" className="text-sm text-rose-300">{error}</p>}
        <div className="flex justify-end gap-3"><button type="button" onClick={() => setOpen(false)} disabled={busy} className="button-secondary">Cancelar</button><button disabled={busy || !selectedCost || selectedCost.fee > devCoins} className="button-primary">{busy ? "Enviando…" : `Enviar reclamação · ${selectedCost?.fee ?? 0} DC`}</button></div>
      </form></section></div>}
  </section>;
}
