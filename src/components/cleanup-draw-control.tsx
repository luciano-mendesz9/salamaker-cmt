"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

type CleanupAssignment = {
  id: string;
  confirmedAt: string;
  student: { id: string; firstName: string; lastName: string };
};

export function CleanupDrawControl({ lessonId, initialAssignments }: { lessonId: string; initialAssignments: CleanupAssignment[] }) {
  const [assignments, setAssignments] = useState(initialAssignments);
  const [busy, setBusy] = useState(false);

  async function draw() {
    if (busy || assignments.length >= 3) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/professor/lessons/${lessonId}/cleanup`, { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(data?.message ?? "Não foi possível sortear o aluno da faxina.");
        return;
      }
      setAssignments((current) => [...current, data.assignment]);
      toast.success(`${data.assignment.student.firstName} ${data.assignment.student.lastName} foi sorteado(a) para a faxina.`);
    } catch {
      toast.error("A conexão foi interrompida durante o sorteio.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="glass rounded-2xl p-5">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h3 className="flex items-center gap-2 font-display font-bold text-blue-300"><Sparkles size={19} />Alunos sorteados para a faxina <span className="text-slate-500">({assignments.length}/3)</span></h3>
        <p className="mt-2 text-xs text-slate-400">Prioriza presentes que ainda não fizeram faxina no mês. Depois, respeita intervalo mínimo de 15 dias.</p>
      </div>
      <button onClick={draw} disabled={busy || assignments.length >= 3} className="button-secondary shrink-0">
        <Sparkles size={16} />{busy ? "Sorteando..." : assignments.length >= 3 ? "Sorteio concluído" : "Sortear aluno"}
      </button>
    </div>
    <div className="mt-4 space-y-2" aria-live="polite">
      {assignments.length ? assignments.map((assignment, index) => <p key={assignment.id} className="rounded-lg bg-slate-950/30 px-3 py-2 text-sm">{index + 1}. {assignment.student.firstName} {assignment.student.lastName}</p>) : <p className="text-sm text-slate-500">Nenhum aluno sorteado.</p>}
    </div>
  </section>;
}
