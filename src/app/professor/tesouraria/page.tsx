import { ProfessorShell } from "@/components/professor-shell";
import { TreasuryManager } from "@/components/treasury-manager";
import { prisma } from "@/lib/db";
import { getCollectiblesReadiness } from "@/lib/feature-readiness";

export default async function TreasuryPage() {
  const readiness = await getCollectiblesReadiness();
  if (!readiness.treasury) return <ProfessorShell title="Tesouraria Dev-Coin"><section className="glass rounded-2xl p-8 text-center"><p className="eyebrow">Implantação pendente</p><h2 className="mt-3 font-display text-2xl font-bold">Tesouraria ainda não inicializada</h2><p className="mt-3 text-slate-400">A migration segura continua pendente no banco compartilhado. Os saldos atuais dos alunos permanecem intactos.</p></section></ProfessorShell>;
  const [treasury, circulation, entries] = await Promise.all([
    prisma.devCoinTreasury.findUniqueOrThrow({ where: { id: 1 }, select: { balance: true, totalSupply: true } }),
    prisma.user.aggregate({ where: { role: "STUDENT" }, _sum: { devCoins: true } }),
    prisma.devCoinTreasuryEntry.findMany({ orderBy: { createdAt: "desc" }, take: 30, select: { id: true, delta: true, reason: true, source: true, createdAt: true } }),
  ]);
  const studentBalance = circulation._sum.devCoins ?? 0;
  return <ProfessorShell title="Tesouraria Dev-Coin"><TreasuryManager initialTreasury={treasury} studentBalance={studentBalance} invariantOk={treasury.totalSupply === treasury.balance + studentBalance} entries={entries}/></ProfessorShell>;
}
