import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Sala Maker CMT", template: "%s · Sala Maker CMT" },
  description: "Presença, aprendizagem e conquistas da turma de Robótica CMT.",
};
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      data-scroll-behavior="smooth"
      className="h-full antialiased"
      style={{ "--accent": "#328fff", "--accent-soft": "#69b5ff" } as React.CSSProperties}
    >
      <body className="min-h-full"><Toaster theme="dark" richColors position="top-right" />{children}</body>
    </html>
  );
}
