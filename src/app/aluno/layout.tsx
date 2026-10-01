import { PowerOff } from "lucide-react";
import { LudoRealtimeBridge } from "@/components/ludo-realtime-bridge";
import { StudentMobileNav } from "@/components/student-mobile-nav";
import { StudentPopupNotifications } from "@/components/student-popup-notifications";
import { requireStudent } from "@/lib/authorization";
import { prisma } from "@/lib/db";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  await requireStudent();
  const settings = await prisma.appSetting.findUnique({ where: { id: 1 }, select: { studentAreaEnabled: true } });
  if (settings && !settings.studentAreaEnabled) {
    return <main className="mesh grid min-h-screen place-items-center p-5"><section className="glass max-w-lg rounded-3xl p-8 text-center"><PowerOff className="mx-auto text-rose-300" size={36}/><h1 className="mt-5 font-display text-2xl font-bold">Área temporariamente indisponível</h1><p className="mt-3 text-slate-300">O site foi desativado temporariamente pelo professor.</p></section></main>;
  }
  return <>{children}<StudentPopupNotifications/><LudoRealtimeBridge/><StudentMobileNav/></>;
}
