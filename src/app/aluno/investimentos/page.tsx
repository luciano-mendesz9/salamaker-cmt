import { Landmark } from "lucide-react";
import { InvestmentDashboard } from "@/components/investment-dashboard";
import { requireStudent } from "@/lib/authorization";
import { getCollectiblesReadiness } from "@/lib/feature-readiness";
import { getInvestmentPortfolio } from "@/lib/investments";

export default async function InvestmentsPage() {
  const { student } = await requireStudent();
  const readiness = await getCollectiblesReadiness();
  if (!readiness.investments) {
    return <main className="mobile-safe"><div className="student-page mx-auto max-w-[1180px]"><section className="student-card rounded-3xl p-8 text-center"><Landmark className="mx-auto text-[var(--accent-soft)]" size={42}/><p className="eyebrow mt-5">Implantação pendente</p><h1 className="mt-3 font-display text-3xl font-black">Carteira de investimentos</h1><p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400">A carteira já está preparada no projeto, mas só será ativada depois que a migration e a reserva de garantia forem configuradas no banco.</p></section></div></main>;
  }
  const portfolio = await getInvestmentPortfolio(student.id);
  return <InvestmentDashboard portfolio={portfolio}/>;
}
