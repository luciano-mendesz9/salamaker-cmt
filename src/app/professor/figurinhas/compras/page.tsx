import { ProfessorShell } from "@/components/professor-shell";
import { TeacherCollectionPurchaseManager } from "@/components/teacher-collection-purchase-manager";
import { requireTeacher } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { getCollectiblesReadiness } from "@/lib/feature-readiness";
import { suggestedCollectionXp } from "@/lib/stickers";

export default async function TeacherCollectionPurchasesPage() {
  await requireTeacher();
  const readiness = await getCollectiblesReadiness();
  if (!readiness.collectionPurchases) {
    return <ProfessorShell title="Comprar coleções"><section className="glass rounded-2xl p-8 text-center"><p className="eyebrow">Implantação pendente</p><h2 className="mt-3 font-display text-2xl font-bold">Compra de coleções ainda não ativada no banco</h2><p className="mt-3 text-slate-400">A interface está preparada, mas a nova migration precisa ser aplicada antes de abrir ofertas aos alunos.</p></section></ProfessorShell>;
  }

  const [collections, requests] = await Promise.all([
    prisma.stickerCollection.findMany({
      where: { state: "ACTIVE", stickers: { some: { state: "PUBLISHED" } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, stickers: { where: { state: "PUBLISHED" }, select: { score: true } } },
    }),
    prisma.teacherCollectionPurchaseRequest.findMany({
      take: 30,
      orderBy: { createdAt: "desc" },
      include: {
        collection: { select: { name: true } },
        offers: { orderBy: { createdAt: "asc" }, select: { id: true, state: true, student: { select: { firstName: true, lastName: true } } } },
        purchase: { select: { xpAmount: true, createdAt: true, student: { select: { firstName: true, lastName: true } } } },
      },
    }),
  ]);

  return <ProfessorShell title="Comprar coleções">
    <p className="eyebrow">Álbum de figurinhas</p>
    <h2 className="mt-3 font-display text-3xl font-bold">Comprar coleção completa</h2>
    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Escolha a coleção e o pagamento em XP. Só pode oferecer quem tiver uma cópia livre de cada figurinha publicada. A roleta sorteia no servidor, transfere exatamente uma coleção ao professor e registra o XP no histórico do aluno.</p>
    <TeacherCollectionPurchaseManager
      collections={collections.map(collection => ({
        id: collection.id,
        name: collection.name,
        stickerCount: collection.stickers.length,
        suggestedXp: suggestedCollectionXp(collection.stickers.map(sticker => sticker.score)),
      }))}
      requests={requests.map(request => ({
        id: request.id,
        collectionName: request.collection.name,
        suggestedXp: request.suggestedXp,
        xpAmount: request.xpAmount,
        state: request.state,
        createdAt: request.createdAt.toISOString(),
        offers: request.offers.map(offer => ({ id: offer.id, name: `${offer.student.firstName} ${offer.student.lastName}`, state: offer.state })),
        purchase: request.purchase ? { name: `${request.purchase.student.firstName} ${request.purchase.student.lastName}`, xpAmount: request.purchase.xpAmount, createdAt: request.purchase.createdAt.toISOString() } : null,
      }))}
    />
  </ProfessorShell>;
}
