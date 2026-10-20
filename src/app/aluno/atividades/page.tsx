import { StudentActivitiesExplorer } from "@/components/student-activities-explorer";
import { effectiveActivityState } from "@/lib/activities";
import { requireStudent } from "@/lib/authorization";
import { prisma } from "@/lib/db";

export default async function StudentActivities() {
  const { student } = await requireStudent();
  const [recipients, settings] = await Promise.all([
    prisma.activityRecipient.findMany({ where: { studentId: student.id }, include: { activity: true, submission: { select: { status: true } }, award: { select: { awardedXp: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.appSetting.findUnique({ where: { id: 1 }, select: { timeZone: true } }),
  ]);
  const items = recipients.map(recipient => ({ id: recipient.activityId, title: recipient.activity.title, description: recipient.activity.description, type: recipient.activity.type, maxXp: recipient.activity.maxXp, opensAt: recipient.activity.opensAt.toISOString(), closesAt: recipient.activity.closesAt.toISOString(), state: effectiveActivityState(recipient.activity), completed: Boolean(recipient.award || recipient.submission || recipient.studentSignaledAt), status: recipient.award ? `Corrigida · ${recipient.award.awardedXp} XP` : recipient.submission ? recipient.submission.status === "AWAITING_REVIEW" ? "Aguardando correção" : "Enviada" : recipient.studentSignaledAt ? "Realizada · aguardando professor" : "Pendente" }));
  return <main className="mobile-safe"><div className="student-page mx-auto max-w-7xl"><div className="mb-7"><p className="eyebrow">Minha jornada na Robótica</p><h1 className="mt-3 font-display text-3xl font-black tracking-tight">Um desafio de cada vez.</h1><p className="mt-2 text-sm leading-relaxed text-slate-400">Encontre suas atividades, veja os prazos e continue aprendendo.</p></div><StudentActivitiesExplorer items={items} timeZone={settings?.timeZone ?? "America/Fortaleza"}/></div></main>;
}
