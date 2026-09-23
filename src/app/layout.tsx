import type { Metadata } from "next";
import { Toaster } from "sonner";
import { prisma } from "@/lib/db";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Sala Maker CMT", template: "%s · Sala Maker CMT" },
  description: "Presença, aprendizagem e conquistas da turma de Robótica CMT.",
};
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const accentColor = await prisma.appSetting.findUnique({ where: { id: 1 }, select: { accentColor: true } }).then(v => v?.accentColor ?? "#328fff").catch(() => "#328fff");
  return (
    <html
      lang="pt-BR"
      data-scroll-behavior="smooth"
      className="h-full antialiased"
      style={{ "--accent": accentColor, "--accent-soft": accentColor } as React.CSSProperties}
    >
      <body className="min-h-full"><Toaster theme="dark" richColors position="top-right" />{children}</body>
    </html>
  );
}
