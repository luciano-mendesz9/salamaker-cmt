import Link from "next/link";
import { ArrowRight, BookOpen, Bot, CalendarDays, CheckCircle2, Clock3, ExternalLink, Gamepad2, Trophy, UserRound, Zap } from "lucide-react";
import { BehaviorChart } from "@/components/behavior-chart";
import { DevCoinWallet } from "@/components/dev-coin-wallet";
import { EmptyState } from "@/components/empty-state";
import { StudentEconomyChart } from "@/components/student-economy-chart";
import { StudentAttendanceButton } from "@/components/student-attendance-button";
import { StudentThemeStore } from "@/components/student-theme-store";
import { TinkercadCard } from "@/components/tinkercad-card";
import { XpAdjustmentAlert } from "@/components/xp-adjustment-alert";
import { effectiveActivityState, formatSchoolDate } from "@/lib/activities";
import { requireStudent } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { remainingWeeklyDevCoinTransfer } from "@/lib/dev-coins";
import { getSchoolWeek } from "@/lib/school-day";
import { getXpAdjustmentSchedule } from "@/lib/xp-adjustment-policy";
import { getStudentThemeState } from "@/lib/student-theme-state";

const labels: Record<string, string> = { GRADE_6_A: "6º Ano A", GRADE_6_B: "6º Ano B", GRADE_6_C: "6º Ano C", GRADE_7_A: "7º Ano A", GRADE_7_B: "7º Ano B", GRADE_7_C: "7º Ano C" };
type DashboardActivity = { activityId: string; studentSignaledAt: Date | null; activity: { title: string; opensAt: Date; closesAt: Date; manuallyClosedAt: Date | null; maxXp: number }; submission: { status: string } | null; award: { awardedXp: number } | null };

export default async function Aluno() {
  const { student } = await requireStudent();
  const weekKey = getSchoolWeek().key;
  const [ranking, closedLessons, presentCount, xpLedger, devCoinLedger, behaviors, settings, transferRecipients, weeklyTransfers, activities, openLesson, themeState] = await Promise.all([
    prisma.user.findMany({ where: { role: "STUDENT", status: "ACTIVE" }, select: { id: true }, orderBy: [{ xp: "desc" }, { createdAt: "asc" }, { id: "asc" }] }),
    prisma.lesson.count({ where: { status: "CLOSED", participants: { some: { studentId: student.id } } } }),
    prisma.attendance.count({ where: { studentId: student.id, status: "PRESENT", lesson: { status: "CLOSED", participants: { some: { studentId: student.id } } } } }),
    prisma.xpEntry.findMany({ where: { studentId: student.id }, select: { id: true, delta: true, reason: true, createdAt: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    prisma.devCoinEntry.findMany({ where: { studentId: student.id }, select: { id: true, delta: true, createdAt: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    prisma.behaviorRating.findMany({ where: { studentId: student.id }, select: { id: true, score: true, reason: true, createdAt: true, lesson: { select: { title: true } } }, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.appSetting.findUnique({ where: { id: 1 }, select: { devCoinsPerXp: true, timeZone: true } }),
    prisma.user.findMany({ where: { role: "STUDENT", status: "ACTIVE", id: { not: student.id } }, select: { id: true, firstName: true, lastName: true }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }] }),
    prisma.devCoinTransfer.aggregate({ where: { senderId: student.id, weekKey }, _sum: { amount: true } }),
    prisma.activityRecipient.findMany({ where: { studentId: student.id }, include: { activity: true, submission: { select: { status: true } }, award: { select: { awardedXp: true } } }, orderBy: { createdAt: "desc" }, take: 3 }),
    prisma.lesson.findFirst({ where: { status: "OPEN" }, select: { id: true, attendances: { where: { studentId: student.id, status: "PRESENT" }, select: { id: true }, take: 1 } } }),
    getStudentThemeState(student.id),
  ]);

  const position = ranking.findIndex(item => item.id === student.id) + 1;
  const frequency = closedLessons ? Math.round(presentCount / closedLessons * 100) : 0;
  const classLabel = student.originSchoolClass ? labels[student.originSchoolClass] : "Turma não informada";
  const timeZone = settings?.timeZone ?? "America/Fortaleza";
  const openActivities = activities.filter(item => effectiveActivityState(item.activity) === "OPEN" && !item.submission && !item.award && !item.studentSignaledAt).length;
  const history = xpLedger.slice(-3).reverse();
  const observedAt = new Date();
  const xpAdjustmentSchedule = getXpAdjustmentSchedule(observedAt);

  return <main className="mobile-safe"><div className="student-page mx-auto max-w-[1240px]">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div><p className="eyebrow text-slate-500">Bem-vindo ao seu espaço</p><h1 className="mt-2 font-display text-3xl font-black tracking-tight">Olá, {student.firstName}<span className="text-[var(--accent-soft)]">.</span></h1></div>
      <span className="inline-flex items-center gap-2 rounded-full border border-slate-700/80 bg-[#111d30] px-4 py-2.5 text-sm font-bold text-slate-300"><UserRound size={16} className="text-[var(--accent-soft)]"/>{classLabel}</span>
    </div>

    <div className="grid gap-5 lg:gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-5 lg:space-y-6">
        <section className="student-dashboard-hero relative flex min-h-[230px] items-center overflow-hidden rounded-3xl border p-6 sm:p-8">
          <div className="relative z-10 max-w-md sm:w-[68%]"><p className="eyebrow flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[var(--accent)]"/>Ideias que ganham vida</p><h2 className="mt-4 font-display text-3xl font-black leading-tight tracking-tight sm:text-4xl">O próximo projeto<br/>começa com você.</h2><p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">Explore suas atividades, crie soluções e avance na sua jornada maker.</p><div className="mt-6 flex flex-wrap gap-3"><Link href="/aluno/atividades" className="button-primary">Ver minhas atividades<ArrowRight size={17}/></Link><a href="https://wayground.com/join" target="_blank" rel="noopener noreferrer" className="focus-ring inline-flex items-center justify-center gap-2 rounded-xl bg-[#ef2d9c] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-pink-950/25 transition hover:brightness-110"><ExternalLink size={17}/>Acessar Wayground</a></div></div>
          <div className="absolute -right-5 top-1/2 hidden h-52 w-52 -translate-y-1/2 sm:grid sm:place-items-center"><span className="absolute inset-3 rounded-full border border-[color-mix(in_srgb,var(--accent)_24%,transparent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]"/><span className="absolute inset-9 rounded-full border border-[color-mix(in_srgb,var(--accent)_30%,transparent)]"/><Bot className="relative text-[var(--accent-soft)] drop-shadow-[0_12px_28px_rgba(0,0,0,.35)]" size={108} strokeWidth={1.35}/><Zap className="absolute bottom-7 left-4 rotate-[-12deg] rounded-xl border border-amber-300/20 bg-[#172238] p-2 text-amber-300" size={40}/><BookOpen className="absolute right-4 top-7 rotate-12 rounded-xl border border-[color-mix(in_srgb,var(--accent)_28%,transparent)] bg-[#172238] p-2 text-[var(--accent-soft)]" size={40}/></div>
        </section>

        <XpAdjustmentAlert startsAt={xpAdjustmentSchedule.startsAt.toISOString()} targetAt={xpAdjustmentSchedule.targetAt.toISOString()} observedAt={observedAt.toISOString()}/>

        <div className="grid grid-cols-3 gap-2 sm:gap-4"><Metric icon={Zap} label="XP atual" value={student.xp.toLocaleString("pt-BR")} unit="XP" detail="Sua experiência acumulada"/><Metric icon={Trophy} label="Ranking" value={position ? `${position}º` : "—"} unit="lugar" detail="Na classificação geral" tone="amber"/><Metric icon={CalendarDays} label="Frequência" value={`${frequency}%`} unit="presença" detail="Nas aulas encerradas" tone="emerald"/></div>

        <section className="student-card rounded-3xl p-5 sm:p-6"><div className="mb-2 flex items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-3"><h2 className="font-display text-xl font-bold">Suas próximas atividades</h2><span className="rounded-full bg-[color-mix(in_srgb,var(--accent)_13%,transparent)] px-3 py-1 text-xs font-bold text-[var(--accent-soft)]">{openActivities} {openActivities === 1 ? "aberta" : "abertas"}</span></div><Link href="/aluno/atividades" className="focus-ring inline-flex items-center gap-1 whitespace-nowrap rounded-lg text-sm font-bold text-[var(--accent-soft)]">Ver todas<ArrowRight size={15}/></Link></div>
          {activities.length ? <div className="divide-y divide-slate-800">{activities.map(item => <ActivityRow key={item.id} item={item} timeZone={timeZone}/>)}</div> : <div className="mt-5"><EmptyState icon={BookOpen} title="Nenhuma atividade" description="As novas atividades da turma aparecerão aqui."/></div>}
        </section>

        <StudentEconomyChart accountCreatedAt={student.createdAt.toISOString()} observedAt={new Date().toISOString()} currentXp={student.xp} currentDevCoins={student.devCoins} xpEntries={xpLedger.map(item => ({ delta: item.delta, createdAt: item.createdAt.toISOString() }))} devCoinEntries={devCoinLedger.map(item => ({ delta: item.delta, createdAt: item.createdAt.toISOString() }))}/>

        <section className="student-card rounded-3xl p-5 sm:p-6"><div className="mb-2 flex items-center justify-between gap-4"><div><h2 className="font-display text-xl font-bold">Cada passo conta.</h2><p className="mt-1 text-sm text-slate-500">Seu histórico recente de XP</p></div></div>
          {history.length ? <div className="divide-y divide-slate-800">{history.map(item => <div key={item.id} className="flex items-center gap-3 py-4"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${item.delta >= 0 ? "bg-emerald-400/10 text-emerald-300" : "bg-rose-400/10 text-rose-300"}`}><Clock3 size={16}/></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold leading-relaxed">{item.reason}</p><p className="mt-1 text-xs text-slate-500">{item.createdAt.toLocaleString("pt-BR")}</p></div><strong className={`whitespace-nowrap text-sm ${item.delta >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{item.delta >= 0 ? "+" : ""}{item.delta} XP</strong></div>)}</div> : <div className="mt-5"><EmptyState icon={Clock3} title="Sem movimentações" description="Suas movimentações de XP aparecerão aqui."/></div>}
        </section>
      </div>

      <aside className="min-w-0 space-y-5 lg:space-y-6" aria-label="Resumo da conta">
        <DevCoinWallet currentDevCoins={student.devCoins} currentXp={student.xp} devCoinsPerXp={settings?.devCoinsPerXp ?? 1} recipients={transferRecipients} weeklyTransferRemaining={remainingWeeklyDevCoinTransfer(weeklyTransfers._sum.amount ?? 0)} quickAction={openLesson && openLesson.attendances.length === 0 ? <StudentAttendanceButton/> : null}/>
        <StudentThemeStore studentId={student.id} activeTheme={themeState.activeTheme} ownedThemes={themeState.ownedThemes} currentDevCoins={student.devCoins} storeReady={themeState.storeReady}/>
        <TinkercadCard accessCode={student.accessCode} showGamesLink={false}/>
        <BehaviorChart ratings={behaviors}/>
      </aside>
    </div>

    <Link href="/aluno/minigames" className="focus-ring group mt-5 flex items-center justify-between gap-4 rounded-3xl border border-fuchsia-300/20 bg-gradient-to-r from-fuchsia-500/12 via-purple-400/8 to-[color-mix(in_srgb,var(--accent)_12%,transparent)] p-5 transition hover:-translate-y-0.5 hover:border-fuchsia-300/40 sm:px-7 sm:py-6"><span className="flex items-center gap-4"><span className="hidden h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/6 text-fuchsia-200 sm:grid"><Gamepad2 size={25}/></span><span><span className="eyebrow text-fuchsia-200/70">Uma pausa para se desafiar</span><strong className="mt-1 block text-lg">Aprender também é jogar.</strong><span className="mt-1 hidden text-sm text-slate-400 sm:block">Ludo Maker, jogo da velha e Sudoku. Explore os minigames.</span></span></span><span className="button-secondary whitespace-nowrap">Vamos jogar<ArrowRight className="transition group-hover:translate-x-1" size={16}/></span></Link>
  </div></main>;
}

function Metric({ icon: Icon, label, value, unit, detail, tone = "accent" }: { icon: typeof Zap; label: string; value: string; unit: string; detail: string; tone?: "accent" | "amber" | "emerald" }) {
  const styles = tone === "amber" ? "bg-amber-400/10 text-amber-300" : tone === "emerald" ? "bg-emerald-400/10 text-emerald-300" : "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent-soft)]";
  return <div className="student-card rounded-2xl p-3 sm:p-5"><div className="mb-4 flex flex-col items-start gap-2 sm:flex-row sm:items-center"><span className={`grid h-9 w-9 place-items-center rounded-xl ${styles}`}><Icon size={18}/></span><span className="text-xs font-semibold text-slate-400">{label}</span></div><p className="font-display text-2xl font-black leading-none sm:text-3xl">{value}<span className="ml-1 text-xs font-semibold text-slate-500 sm:text-sm">{unit}</span></p><p className="mt-3 hidden text-xs text-slate-500 sm:block">{detail}</p></div>;
}

function ActivityRow({ item, timeZone }: { item: DashboardActivity; timeZone: string }) {
  const state = effectiveActivityState(item.activity);
  const complete = Boolean(item.award || item.submission || item.studentSignaledAt);
  return <Link href={`/aluno/atividades/${item.activityId}`} className="focus-ring group flex items-center gap-3 rounded-xl py-4 transition hover:bg-white/3 sm:gap-4 sm:px-1"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent-soft)]">{complete ? <CheckCircle2 size={20}/> : <BookOpen size={20}/>}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{item.activity.title}</strong><span className="mt-1 block text-xs text-slate-500">{state === "OPEN" ? `Até ${formatSchoolDate(item.activity.closesAt, timeZone)}` : state === "SCHEDULED" ? `Abre em ${formatSchoolDate(item.activity.opensAt, timeZone)}` : "Encerrada"} · {item.award ? `${item.award.awardedXp} XP recebidos` : complete ? "Enviada" : "Pendente"}</span></span><span className="hidden text-sm font-bold text-[var(--accent-soft)] sm:block">+{item.activity.maxXp} XP</span><ArrowRight className="shrink-0 text-slate-600 transition group-hover:translate-x-1" size={16}/></Link>;
}
