import Link from "next/link";
import { ArrowLeft, Coins, UserRound, Zap } from "lucide-react";
import { z } from "zod";
import { ProfessorShell } from "@/components/professor-shell";
import { StudentLedgerHistory } from "@/components/student-ledger-history";
import { prisma } from "@/lib/db";

const studentIdSchema = z.string().uuid();
const name = (user: { firstName: string; lastName: string } | null) => user ? `${user.firstName} ${user.lastName}` : null;

export default async function StudentHistoryPage({ searchParams }: { searchParams: Promise<{ id?: string | string[] }> }) {
  const rawId = (await searchParams).id;
  const parsedId = studentIdSchema.safeParse(typeof rawId === "string" ? rawId : "");

  if (!parsedId.success) return <ProfessorShell title="Histórico do aluno"><EmptyHistory message="Aluno não informado ou identificador inválido." /></ProfessorShell>;

  const student = await prisma.user.findFirst({
    where: { id: parsedId.data, role: "STUDENT" },
    select: {
      id: true, firstName: true, lastName: true, accessCode: true, xp: true, devCoins: true, status: true,
      xpEntries: { include: { author: { select: { firstName: true, lastName: true } }, lesson: { select: { title: true } } }, orderBy: { createdAt: "desc" } },
      devCoinEntries: { include: { author: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!student) return <ProfessorShell title="Histórico do aluno"><EmptyHistory message="O aluno solicitado não foi encontrado." /></ProfessorShell>;

  const xp = student.xpEntries.map((entry) => ({
    id: entry.id, delta: entry.delta, reason: entry.reason, source: entry.source, idempotencyKey: entry.idempotencyKey,
    createdAt: entry.createdAt.toISOString(), author: name(entry.author), context: entry.lesson?.title ?? null,
  }));
  const devCoins = student.devCoinEntries.map((entry) => ({
    id: entry.id, delta: entry.delta, reason: entry.reason, source: entry.source, idempotencyKey: entry.idempotencyKey,
    createdAt: entry.createdAt.toISOString(), author: name(entry.author), context: null,
  }));

  return <ProfessorShell title="Histórico do aluno">
    <Link href="/professor" className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"><ArrowLeft size={16} />Voltar ao dashboard</Link>
    <section className="mt-6 rounded-3xl border border-blue-400/20 bg-gradient-to-r from-[#142b4c] via-[#10223b] to-[#101b2f] p-6 sm:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-blue-400/10 text-blue-300"><UserRound size={26} /></span><div className="flex-1"><p className="eyebrow">Extrato individual</p><h2 className="mt-2 font-display text-3xl font-bold">{student.firstName} {student.lastName}</h2><p className="mt-2 text-sm text-slate-400">Código {student.accessCode} · {student.status === "ACTIVE" ? "Aluno ativo" : "Aluno arquivado"}</p></div><div className="grid grid-cols-2 gap-3"><Summary icon={Zap} label="Saldo de XP" value={`${student.xp} XP`} tone="blue" /><Summary icon={Coins} label="Saldo de Dev-Coins" value={`${student.devCoins} DC`} tone="amber" /></div></div>
    </section>
    <StudentLedgerHistory xp={xp} devCoins={devCoins} />
  </ProfessorShell>;
}

function Summary({ icon: Icon, label, value, tone }: { icon: typeof Zap; label: string; value: string; tone: "blue" | "amber" }) { return <div className="min-w-36 rounded-2xl border border-white/10 bg-slate-950/30 p-4"><p className={`flex items-center gap-2 text-xs ${tone === "blue" ? "text-blue-300" : "text-amber-300"}`}><Icon size={15} />{label}</p><p className="mt-2 font-display text-xl font-bold">{value}</p></div>; }
function EmptyHistory({ message }: { message: string }) { return <div className="glass mt-7 rounded-2xl p-10 text-center"><UserRound className="mx-auto text-slate-600" /><h2 className="mt-4 font-display text-xl font-bold">Histórico indisponível</h2><p className="mt-2 text-sm text-slate-400">{message}</p><Link href="/professor" className="button-secondary mt-5 inline-flex">Voltar ao dashboard</Link></div>; }
