import Link from "next/link";
import { Prisma } from "@/generated/prisma/client";
import { ComplaintRevokeForm } from "@/components/complaint-revoke-form";
import { ProfessorShell } from "@/components/professor-shell";
import { requireTeacher } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { studentComplaintsSchemaReady } from "@/lib/feature-readiness";
import { complaintPeriod } from "@/lib/student-complaint-period";

type Filters = { status?: string; kind?: string; q?: string; page?: string };

export default async function StudentComplaints({ searchParams }: { searchParams: Promise<Filters> }) {
  await requireTeacher();
  if (!(await studentComplaintsSchemaReady())) return <ProfessorShell title="Reclamações"><section className="glass rounded-2xl p-7"><h1 className="font-display text-2xl font-bold">Reclamações</h1><p className="mt-3 text-sm text-slate-400">Aguardando a atualização do banco de dados.</p></section></ProfessorShell>;

  const filters = await searchParams;
  const status = filters.status === "ACTIVE" || filters.status === "REVOKED" ? filters.status : undefined;
  const kind = filters.kind === "STUDENT" || filters.kind === "TEACHER" ? filters.kind : undefined;
  const q = filters.q?.trim().slice(0, 100) ?? "";
  const page = Math.max(1, Math.min(10000, Number.parseInt(filters.page ?? "1", 10) || 1));
  const now = new Date();
  const [settings, cycle, activeTotal, revokedTotal, teacherTotal] = await Promise.all([
    prisma.appSetting.findUnique({ where: { id: 1 }, select: { timeZone: true } }),
    prisma.complaintCycle.findUnique({ where: { id: 1 }, select: { resetAt: true } }),
    prisma.studentComplaint.count({ where: { status: "ACTIVE" } }),
    prisma.studentComplaint.count({ where: { status: "REVOKED" } }),
    prisma.studentComplaint.count({ where: { status: "ACTIVE", targetKind: "TEACHER" } }),
  ]);
  const timeZone = settings?.timeZone ?? "America/Fortaleza";
  const period = complaintPeriod(now, cycle?.resetAt, timeZone);
  const where: Prisma.StudentComplaintWhereInput = {
    ...(status ? { status } : {}),
    ...(kind ? { targetKind: kind } : {}),
    ...(q ? { OR: [
      { reporter: { firstName: { contains: q, mode: "insensitive" } } },
      { reporter: { lastName: { contains: q, mode: "insensitive" } } },
      { target: { firstName: { contains: q, mode: "insensitive" } } },
      { target: { lastName: { contains: q, mode: "insensitive" } } },
      { lesson: { title: { contains: q, mode: "insensitive" } } },
    ] } : {}),
  };
  const [complaints, monthTotal, filteredTotal] = await Promise.all([
    prisma.studentComplaint.findMany({
      where,
      include: {
        reporter: { select: { firstName: true, lastName: true } },
        target: { select: { firstName: true, lastName: true } },
        lesson: { select: { title: true, openedAt: true } },
        feeEntry: { select: { delta: true } },
        revokedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      skip: (page - 1) * 50,
    }),
    prisma.studentComplaint.count({ where: { status: "ACTIVE", targetKind: "STUDENT", createdAt: { gte: period.monthStart, lt: period.monthEnd } } }),
    prisma.studentComplaint.count({ where }),
  ]);
  const formatDate = (date: Date) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone }).format(date);
  const pageUrl = (number: number) => `/professor/reclamacoes?${new URLSearchParams({ ...(status ? { status } : {}), ...(kind ? { kind } : {}), ...(q ? { q } : {}), page: String(number) })}`;

  return <ProfessorShell title="Reclamações">
    <p className="eyebrow">Acompanhamento da turma</p>
    <h1 className="mt-3 font-display text-3xl font-bold">Reclamações</h1>
    <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">Somente o professor vê quem enviou e o motivo. Confira a aula e o relato antes de agir. Cada aluno pode reclamar até três vezes do mesmo colega na aula, por 2, 5 e 10 DevCoins. A reclamação do professor é gratuita e limitada a uma por aluno na aula. Revogar remove a reclamação dos contadores, mas preserva o histórico, o custo pago e o limite de envios.</p>

    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Summary label="Alunos · contam neste mês" value={monthTotal}/>
      <Link href="/professor/reclamacoes?kind=TEACHER&status=ACTIVE" className="glass rounded-2xl p-4 transition hover:border-amber-300/50"><SummaryContent label="Sobre professores · ativas" value={teacherTotal}/><span className="mt-2 block text-xs font-semibold text-amber-300">Abrir relatos →</span></Link>
      <Summary label="Ativas no histórico" value={activeTotal}/>
      <Summary label="Revogadas no histórico" value={revokedTotal}/>
    </div>

    <form className="glass mt-6 flex flex-wrap items-end gap-3 rounded-2xl p-4">
      <label className="min-w-48 flex-1 text-sm font-semibold">Buscar aluno, professor ou aula<input name="q" defaultValue={q} className="input mt-2" placeholder="Nome ou título da aula"/></label>
      <label className="text-sm font-semibold">Sobre<select name="kind" defaultValue={kind ?? ""} className="input mt-2"><option value="">Todos</option><option value="STUDENT">Aluno</option><option value="TEACHER">Professor</option></select></label>
      <label className="text-sm font-semibold">Estado<select name="status" defaultValue={status ?? ""} className="input mt-2"><option value="">Todos</option><option value="ACTIVE">Ativas</option><option value="REVOKED">Revogadas</option></select></label>
      <button className="button-secondary min-h-11">Filtrar</button>
    </form>

    <div className="mt-6 space-y-4">
      {complaints.length ? complaints.map(item => <article key={item.id} className="glass rounded-2xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-blue-300">{item.lesson.title} · {formatDate(item.lesson.openedAt)}</p>
            <h2 className="mt-2 font-display text-lg font-bold">{item.targetKind === "TEACHER" ? "Reclamação do professor" : "Reclamação de aluno"}: {item.target.firstName} {item.target.lastName}</h2>
            <p className="mt-1 text-sm text-slate-400">Enviada por {item.reporter.firstName} {item.reporter.lastName} em {formatDate(item.createdAt)}</p>
            <p className="mt-1 text-xs text-slate-400">{item.targetKind === "TEACHER" ? "Envio único nesta aula · grátis" : `${item.ordinal}ª reclamação deste aluno sobre a mesma pessoa nesta aula · ${Math.abs(item.feeEntry?.delta ?? 0)} DevCoins`}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${item.status === "ACTIVE" ? "bg-amber-400/10 text-amber-300" : "bg-slate-700 text-slate-300"}`}>{item.status === "ACTIVE" ? "Ativa" : "Revogada"}</span>
        </div>
        <div className="mt-4 rounded-xl border border-[var(--line)] bg-slate-950/30 p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Motivo relatado</p><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{item.reason}</p></div>
        {item.status === "ACTIVE" ? <ComplaintRevokeForm complaintId={item.id}/> : <p className="mt-4 text-sm text-slate-400">Revogada em {item.revokedAt ? formatDate(item.revokedAt) : "—"} por {item.revokedBy ? `${item.revokedBy.firstName} ${item.revokedBy.lastName}` : "professor"}. Justificativa: {item.revocationReason}</p>}
      </article>) : <div className="glass rounded-2xl p-8 text-center text-sm text-slate-400">Nenhuma reclamação encontrada.</div>}
    </div>
    {filteredTotal > 50&&<nav aria-label="Páginas de reclamações" className="mt-5 flex items-center justify-between gap-3 text-sm"><span className="text-slate-400">Página {page} de {Math.ceil(filteredTotal / 50)} · {filteredTotal} registros</span><div className="flex gap-2">{page > 1&&<Link href={pageUrl(page - 1)} className="button-secondary">Anterior</Link>}{page * 50 < filteredTotal&&<Link href={pageUrl(page + 1)} className="button-secondary">Próxima</Link>}</div></nav>}
  </ProfessorShell>;
}

function Summary({ label, value }: { label: string; value: number }) { return <div className="glass rounded-2xl p-4"><SummaryContent label={label} value={value}/></div>; }
function SummaryContent({ label, value }: { label: string; value: number }) { return <><p className="text-sm text-slate-400">{label}</p><strong className="mt-2 block font-display text-3xl font-bold">{value}</strong></>; }
