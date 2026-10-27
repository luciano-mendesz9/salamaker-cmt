import { PowerOff } from "lucide-react";
import { LudoRealtimeBridge } from "@/components/ludo-realtime-bridge";
import { StudentPopupNotifications } from "@/components/student-popup-notifications";
import { StudentShell } from "@/components/student-shell";
import { prisma } from "@/lib/db";
import { requireStudent } from "@/lib/authorization";
import { getStudentThemeState } from "@/lib/student-theme-state";

const classLabels: Record<string, string> = { GRADE_6_A: "6º Ano A", GRADE_6_B: "6º Ano B", GRADE_6_C: "6º Ano C", GRADE_7_A: "7º Ano A", GRADE_7_B: "7º Ano B", GRADE_7_C: "7º Ano C" };

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const { student } = await requireStudent();
  const [settings, inboxCount, readCount, themeState] = await Promise.all([
    prisma.appSetting.findUnique({ where: { id: 1 }, select: { studentAreaEnabled: true } }),
    prisma.notification.count({ where: { kind: "INBOX" } }),
    prisma.notificationReceipt.count({ where: { studentId: student.id, readAt: { not: null }, notification: { kind: "INBOX" } } }),
    getStudentThemeState(student.id),
  ]);
  if (settings && !settings.studentAreaEnabled) {
    return <main className="mesh grid min-h-screen place-items-center p-5"><section className="glass max-w-lg rounded-3xl p-8 text-center"><PowerOff className="mx-auto text-rose-300" size={36}/><h1 className="mt-5 font-display text-2xl font-bold">Área temporariamente indisponível</h1><p className="mt-3 text-slate-300">O site foi desativado temporariamente pelo professor.</p></section></main>;
  }
  return <StudentShell student={{ id: student.id, firstName: student.firstName, lastName: student.lastName, profileAvatar: student.profileAvatar, classLabel: student.originSchoolClass ? classLabels[student.originSchoolClass] : "Turma não informada" }} unread={Math.max(0, inboxCount - readCount)} theme={themeState.activeTheme}>{children}<StudentPopupNotifications/><LudoRealtimeBridge/></StudentShell>;
}
