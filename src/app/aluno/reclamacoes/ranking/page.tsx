import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, MessageSquareWarning } from "lucide-react";
import { requireStudent } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { studentComplaintsSchemaReady } from "@/lib/feature-readiness";
import { complaintPeriod } from "@/lib/student-complaint-period";
import { getProfileAvatar } from "@/lib/profile-avatars";

const classLabels: Record<string, string> = { GRADE_6_A: "6º Ano A", GRADE_6_B: "6º Ano B", GRADE_6_C: "6º Ano C", GRADE_7_A: "7º Ano A", GRADE_7_B: "7º Ano B", GRADE_7_C: "7º Ano C" };

export default async function ComplaintRanking() {
  const { student: viewer } = await requireStudent();
  if (!(await studentComplaintsSchemaReady())) return <main className="student-page mx-auto max-w-3xl"><Link href="/aluno" className="text-[var(--accent-soft)]">Voltar ao início</Link><section className="student-card mt-6 rounded-3xl p-7"><h1 className="font-display text-2xl font-bold">Ranking de reclamações</h1><p className="mt-3 text-[var(--muted)]">Aguardando a atualização do banco de dados.</p></section></main>;
  const now = new Date();
  const [cycle, settings, students] = await Promise.all([
    prisma.complaintCycle.findUnique({ where: { id: 1 }, select: { resetAt: true } }),
    prisma.appSetting.findUnique({ where: { id: 1 }, select: { timeZone: true } }),
    prisma.user.findMany({ where: { role: "STUDENT", status: "ACTIVE" }, select: { id: true, originSchoolClass: true, profileAvatar: true } }),
  ]);
  const period = complaintPeriod(now, cycle?.resetAt, settings?.timeZone ?? "America/Fortaleza");
  const totals = await prisma.studentComplaint.groupBy({ by: ["targetId"], where: { targetKind: "STUDENT", status: "ACTIVE", createdAt: { gte: period.monthStart, lt: period.monthEnd } }, _count: { _all: true } });
  const counts = new Map(totals.map(item => [item.targetId, item._count._all]));
  const ranking = students.map(student => ({ ...student, count: counts.get(student.id) ?? 0 })).sort((a, b) => b.count - a.count || String(a.originSchoolClass ?? "").localeCompare(String(b.originSchoolClass ?? "")) || a.id.localeCompare(b.id));

  return <main className="mobile-safe"><div className="student-page mx-auto max-w-3xl"><Link href="/aluno" className="focus-ring inline-flex items-center gap-2 text-sm font-bold text-[var(--accent-soft)]"><ArrowLeft size={17}/>Voltar ao início</Link><section className="student-card mt-6 rounded-3xl p-5 sm:p-7"><p className="eyebrow">Turma de Robótica</p><h1 className="mt-3 flex items-center gap-3 font-display text-3xl font-bold"><MessageSquareWarning className="text-[var(--accent-soft)]"/>Ranking de reclamações</h1><p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">Reclamações registradas neste mês. A contagem é zerada quando ocorre o reajuste mensal de XP. Registros revogados não contam. Uma reclamação não confirma que o fato aconteceu.</p>
    {totals.length === 0&&<p className="mt-5 text-sm text-[var(--muted)]">Nenhuma reclamação ativa neste período. Todos estão com zero.</p>}
    {ranking.length?<ol className="mt-6 space-y-3">{ranking.map((student, index) => { const isSelf = student.id === viewer.id; const className = classLabels[student.originSchoolClass ?? ""]; return <li key={student.id} className={`flex items-center gap-3 rounded-2xl border p-4 sm:gap-4 ${isSelf ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,var(--surface))]" : "border-[var(--line)] bg-[var(--surface)]"}`}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] font-bold text-[var(--accent-soft)]">{index + 1}º</span><span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-[var(--line)]"></span><span className="min-w-0 flex-1"><span className="block truncate font-semibold">{isSelf ? `${viewer.firstName} ${viewer.lastName}` : className ? `Aluno do ${className}` : "Aluno sem turma informada"}</span>{isSelf&&<span className="text-xs font-bold text-[var(--accent-soft)]">Você</span>}</span><strong className="whitespace-nowrap text-sm text-[var(--accent-soft)]">{student.count} {student.count === 1 ? "reclamação" : "reclamações"}</strong></li>; })}</ol>:<p className="mt-6 rounded-2xl border border-dashed border-[var(--line)] p-6 text-center text-sm text-[var(--muted)]">Nenhum aluno ativo encontrado.</p>}
  </section></div></main>;
}
