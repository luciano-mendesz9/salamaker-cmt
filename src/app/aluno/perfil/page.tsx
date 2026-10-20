import { Info } from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import { ProfileAvatarEditor } from "@/components/profile-avatar-picker";
import { StudentAccessCode } from "@/components/student-access-code";
import { requireStudent } from "@/lib/authorization";
import { prisma } from "@/lib/db";

const labels: Record<string, string> = { GRADE_6_A: "6º Ano A", GRADE_6_B: "6º Ano B", GRADE_6_C: "6º Ano C", GRADE_7_A: "7º Ano A", GRADE_7_B: "7º Ano B", GRADE_7_C: "7º Ano C" };

export default async function StudentProfilePage() {
  const { student } = await requireStudent();
  const [ranking, avatarPurchases] = await Promise.all([
    prisma.user.findMany({ where: { role: "STUDENT", status: "ACTIVE" }, select: { id: true }, orderBy: [{ xp: "desc" }, { createdAt: "asc" }, { id: "asc" }] }),
    prisma.profileAvatarPurchase.findMany({ where: { studentId: student.id }, select: { avatarKey: true } }),
  ]);
  const position = ranking.findIndex(item => item.id === student.id) + 1;
  const classLabel = student.originSchoolClass ? labels[student.originSchoolClass] : "Turma não informada";

  return <main className="mobile-safe"><div className="student-page mx-auto max-w-5xl">
    <div className="mb-7"><p className="eyebrow">Minha conta</p><h1 className="mt-3 font-display text-3xl font-black tracking-tight">Seu perfil, do seu jeito.</h1><p className="mt-2 text-sm leading-relaxed text-slate-400">Suas informações de acesso à Sala Maker.</p></div>
    <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
      <section className="student-card rounded-3xl p-7 text-center">
        <div className="flex justify-center"><ProfileAvatarEditor currentAvatar={student.profileAvatar} currentDevCoins={student.devCoins} ownedAvatars={avatarPurchases.map(item => item.avatarKey)} studentName={student.firstName}/></div>
        <p className="mt-4 text-sm font-bold text-[var(--accent-soft)]">Clique na foto para alterar</p>
        <h2 className="mt-6 font-display text-2xl font-bold">{student.firstName} {student.lastName}</h2><p className="mt-2 text-sm text-slate-400">{classLabel} · Turma de Robótica</p>
        <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-300"><span className="h-2 w-2 rounded-full bg-emerald-400"/>Ativo na Robótica</span>
        <div className="mt-7 grid grid-cols-2 border-t border-slate-800 pt-6"><div><strong className="font-display text-2xl">{student.xp.toLocaleString("pt-BR")}</strong><p className="mt-1 text-xs text-slate-500">XP acumulado</p></div><div className="border-l border-slate-800"><strong className="font-display text-2xl">{position ? `${position}º` : "—"}</strong><p className="mt-1 text-xs text-slate-500">Ranking geral</p></div></div>
      </section>
      <section className="student-card rounded-3xl p-6 sm:p-7"><h2 className="font-display text-xl font-bold">Informações da conta</h2><dl className="mt-6 space-y-5"><AccountInfo label="Nome completo" value={`${student.firstName} ${student.lastName}`}/><AccountInfo label="Turma regular de origem" value={classLabel}/><div><dt className="mb-2 text-xs text-slate-500">Código de matrícula</dt><dd><StudentAccessCode value={student.accessCode}/></dd></div><AccountInfo label="Último login" value={student.lastLoginAt ? student.lastLoginAt.toLocaleString("pt-BR") : "Primeiro acesso"}/></dl>
        <div className="mt-7 flex gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--accent)_15%,transparent)] bg-[color-mix(in_srgb,var(--accent)_7%,transparent)] p-4"><Info className="mt-0.5 shrink-0 text-[var(--accent-soft)]" size={18}/><p className="text-sm leading-relaxed text-slate-400">No sistema, sua sessão é encerrada automaticamente 30 minutos após o login.</p></div>
        <div className="mt-6 inline-flex rounded-xl border border-slate-700 bg-slate-900/60 px-2"><LogoutButton label/></div>
      </section>
    </div>
  </div></main>;
}

function AccountInfo({ label, value }: { label: string; value: string }) { return <div><dt className="mb-2 text-xs text-slate-500">{label}</dt><dd className="text-sm font-semibold">{value}</dd></div>; }
