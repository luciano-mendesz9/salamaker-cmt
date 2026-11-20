import { ProfessorShell } from "@/components/professor-shell";
import { BrexSettingsForm } from "@/components/brex-settings-form";
import { prisma } from "@/lib/db";

export default async function BrexTeacherPage() {
  const result = await prisma.brexSetting.findUnique({ where: { id: 1 } }).then(settings => ({ settings, ready: true })).catch(() => ({ settings: null, ready: false }));
  return <ProfessorShell title="Brex AI"><div className="mx-auto max-w-3xl space-y-6"><div><p className="eyebrow">Inteligência artificial · Sala Maker</p><h1 className="mt-3 font-display text-3xl font-black">Brex AI</h1><p className="mt-3 text-sm text-slate-400">Controle quando o assistente aparece para os alunos e qual servidor local recebe as perguntas.</p></div><BrexSettingsForm initial={{ enabled: result.settings?.enabled ?? false, version: result.settings?.version ?? "0.1.0", origin: result.settings?.origin ?? "" }} schemaReady={result.ready}/></div></ProfessorShell>;
}
