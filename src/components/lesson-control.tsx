"use client";

import { useEffect, useState } from "react";
import { BookOpen, CheckCircle2, Copy, LockKeyhole, Maximize2, Plus, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type Student = { id: string; firstName: string; lastName: string; originSchoolClass: string | null };
type Cleanup = { id: string; confirmedAt: string; student: { id: string; firstName: string; lastName: string } };
type Lesson = { id: string; title: string; openedAt: string; attendances: { studentId: string; status: string }[]; cleanups: Cleanup[] };

export function LessonControl({ initialLesson, initialStudents, initialCode }: { initialLesson: Lesson | null; initialStudents: Student[]; initialCode: string | null }) {
  const router = useRouter();
  const [lesson, setLesson] = useState(initialLesson);
  const [students, setStudents] = useState(initialStudents);
  const [modal, setModal] = useState<"open" | "close" | null>(null);
  const [code, setCode] = useState<string | null>(initialCode);
  const [excused, setExcused] = useState<string[]>([]);
  const [manualPresent, setManualPresent] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const [codeFullscreen, setCodeFullscreen] = useState(false);

  useEffect(() => {
    if (!codeFullscreen) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCodeFullscreen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [codeFullscreen]);

  async function reload() {
    const response = await fetch("/api/professor/lessons");
    const data = await response.json();
    if (!response.ok) {
      toast.error(data.message ?? "Não foi possível atualizar a aula.");
      return false;
    }
    setLesson(data.lesson);
    setStudents(data.students);
    setCode(data.lesson?.code ?? null);
    return true;
  }

  async function open(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/professor/lessons", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: form.get("title") }) });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      toast.error(data.message);
      return;
    }
    setCode(data.code);
    await reload();
    setModal(null);
    toast.success("Aula aberta para toda a turma de Robótica.");
    router.refresh();
  }

  async function review() {
    setExcused([]);
    setManualPresent([]);
    if (!(await reload())) return;
    setModal("close");
  }

  async function drawCleanup() {
    if (!lesson || cleanupBusy || lesson.cleanups.length >= 3) return;
    setCleanupBusy(true);
    try {
      const response = await fetch(`/api/professor/lessons/${lesson.id}/cleanup`, { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(data?.message ?? "Não foi possível sortear o aluno da faxina.");
        return;
      }
      setLesson((current) => current ? { ...current, cleanups: [...current.cleanups, data.assignment] } : current);
      toast.success(`${data.assignment.student.firstName} ${data.assignment.student.lastName} foi sorteado(a) para a faxina.`);
    } catch {
      toast.error("A conexão foi interrompida durante o sorteio.");
    } finally {
      setCleanupBusy(false);
    }
  }

  async function close() {
    if (!lesson) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/professor/lessons/${lesson.id}/close`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ excusedIds: excused, presentIds: manualPresent }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(data?.message ?? "Não foi possível fechar a aula. Tente novamente.");
        return;
      }
      setLesson(null);
      setStudents([]);
      setCode(null);
      setCodeFullscreen(false);
      setExcused([]);
      setManualPresent([]);
      setModal(null);
      toast.success(`Aula fechada para ${data.students} aluno(s). XP aplicado.`);
      router.refresh();
    } catch {
      toast.error("A conexão foi interrompida. Verifique a aula antes de tentar novamente.");
    } finally {
      setBusy(false);
    }
  }

  const present = new Set(lesson?.attendances.filter((attendance) => attendance.status === "PRESENT").map((attendance) => attendance.studentId));

  return <>
    <div className="mt-7 flex flex-wrap gap-3">
      {!lesson ? <button onClick={() => setModal("open")} className="button-primary"><Plus size={17} />Abrir nova aula</button> : <div className="w-full rounded-2xl border border-emerald-400/25 bg-emerald-400/8 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-400/15 text-emerald-300"><BookOpen /></span>
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">Aula aberta · toda a turma</p>
            <h3 className="font-display font-bold">{lesson.title}</h3>
            <p className="text-xs text-slate-400">{lesson.attendances.length} presença(s) de {students.length} participante(s)</p>
          </div>
          {code && <div className="flex flex-wrap gap-2">
            <button onClick={() => { navigator.clipboard.writeText(code); toast.success("Código copiado.") }} className="button-secondary font-mono text-lg"><Copy size={16} />{code}</button>
            <button onClick={() => setCodeFullscreen(true)} className="button-secondary" aria-label="Exibir código da aula em tela cheia"><Maximize2 size={16} />Tela cheia</button>
          </div>}
          <button onClick={review} className="button-primary"><LockKeyhole size={16} />Revisar e fechar</button>
        </div>

        <div className="mt-5 border-t border-emerald-400/15 pt-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex items-center gap-2 font-display font-bold text-blue-200"><Sparkles size={18} />Faxina da aula <span className="text-sm text-slate-400">({lesson.cleanups.length}/3)</span></p>
              <p className="mt-1 text-xs text-slate-400">Prioriza presentes que ainda não fizeram faxina no mês. Depois, respeita intervalo mínimo de 15 dias.</p>
            </div>
            <button onClick={drawCleanup} disabled={cleanupBusy || lesson.cleanups.length >= 3} className="button-secondary shrink-0">
              <Sparkles size={16} />{cleanupBusy ? "Sorteando..." : lesson.cleanups.length >= 3 ? "Sorteio concluído" : "Sortear aluno da faxina"}
            </button>
          </div>
          {lesson.cleanups.length > 0 && <div className="mt-4 flex flex-wrap gap-2" aria-live="polite">
            {lesson.cleanups.map((cleanup, index) => <span key={cleanup.id} className="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1.5 text-sm text-blue-100">{index + 1}. {cleanup.student.firstName} {cleanup.student.lastName}</span>)}
          </div>}
        </div>
      </div>}
    </div>

    {modal && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/85 p-4"><div className="glass my-6 w-full max-w-xl rounded-2xl p-6">
      <div className="flex justify-between"><h3 className="font-display text-xl font-bold">{modal === "open" ? "Abrir nova aula" : "Revisar fechamento"}</h3><button onClick={() => setModal(null)} aria-label="Fechar"><X /></button></div>
      {modal === "open" ? <form onSubmit={open} className="mt-6 space-y-4">
        <input name="title" className="input" placeholder="Título da aula" required />
        <p className="rounded-xl border border-blue-400/20 bg-blue-400/8 p-3 text-sm text-blue-100">A aula incluirá todos os alunos ativos da turma de Robótica, independentemente da turma regular de origem.</p>
        <button disabled={busy} className="button-primary w-full">Abrir aula e gerar código</button>
      </form> : <div className="mt-6">
        {code && <div className="mb-4 flex flex-col gap-3 rounded-xl border border-blue-400/25 bg-blue-400/8 p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-blue-300">Código da aula</p><p className="mt-1 font-mono text-2xl font-bold tracking-[.2em]">{code}</p></div><div className="flex flex-wrap gap-2"><button onClick={() => { navigator.clipboard.writeText(code); toast.success("Código copiado.") }} className="button-secondary" aria-label="Copiar código da aula"><Copy size={16} />Copiar</button><button onClick={() => setCodeFullscreen(true)} className="button-secondary" aria-label="Exibir código da aula em tela cheia"><Maximize2 size={16} />Tela cheia</button></div></div>}
        <p className="text-sm text-slate-400">Presentes receberão +30 XP. Para quem esqueceu o registro, marque a presença manualmente; você também pode justificar uma falta (+10 XP). As demais ausências receberão −50 XP.</p>
        <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">{students.map((student) => {
          const attendanceRecorded = present.has(student.id);
          const isManuallyPresent = manualPresent.includes(student.id);
          const isPresent = attendanceRecorded || isManuallyPresent;
          return <div key={student.id} className="flex flex-col gap-3 rounded-xl border border-slate-700 p-3 sm:flex-row sm:items-center"><span className={`h-2.5 w-2.5 shrink-0 rounded-full ${isPresent ? "bg-emerald-400" : "bg-rose-400"}`} /><span className="flex-1 text-sm">{student.firstName} {student.lastName}</span>{attendanceRecorded ? <span className="text-xs text-emerald-300">Presença registrada</span> : <div className="flex flex-wrap gap-3"><label className="flex items-center gap-2 text-xs text-emerald-200"><input type="checkbox" checked={isManuallyPresent} onChange={(event) => { setManualPresent((current) => event.target.checked ? [...current, student.id] : current.filter((id) => id !== student.id)); if (event.target.checked) setExcused((current) => current.filter((id) => id !== student.id)); }} />Marcar presença</label><label className="flex items-center gap-2 text-xs text-amber-200"><input type="checkbox" checked={excused.includes(student.id)} onChange={(event) => { setExcused((current) => event.target.checked ? [...current, student.id] : current.filter((id) => id !== student.id)); if (event.target.checked) setManualPresent((current) => current.filter((id) => id !== student.id)); }} />Falta justificada</label></div>}</div>
        })}</div>
        <button disabled={busy} onClick={close} className="button-primary mt-5 w-full"><CheckCircle2 size={17} />{busy ? "Fechando..." : "Confirmar fechamento e aplicar XP"}</button>
      </div>}
    </div></div>}

    {codeFullscreen && code && <div className="fixed inset-0 z-[60] flex min-h-dvh flex-col bg-[#08111f] p-5 sm:p-8" role="dialog" aria-modal="true" aria-labelledby="fullscreen-code-title">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Sala Maker CMT</p>
          <h3 id="fullscreen-code-title" className="font-display text-xl font-bold text-white sm:text-2xl">Código da aula</h3>
        </div>
        <button autoFocus onClick={() => setCodeFullscreen(false)} className="button-secondary" aria-label="Fechar código em tela cheia"><X size={20} />Fechar</button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
        <p className="font-mono text-[clamp(4rem,18vw,14rem)] font-black leading-none tracking-[.12em] text-blue-300 drop-shadow-[0_0_40px_rgba(96,165,250,0.25)] sm:tracking-[.18em]">{code}</p>
        <p className="mt-8 text-base text-slate-300 sm:text-xl">Digite este código para registrar sua presença.</p>
      </div>
    </div>}
  </>;
}
