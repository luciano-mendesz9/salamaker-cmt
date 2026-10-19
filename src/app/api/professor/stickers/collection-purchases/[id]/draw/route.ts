import { NextResponse } from "next/server";
import { apiError, requireTeacher } from "@/lib/authorization";
import { requireCollectionPurchasesSchema } from "@/lib/feature-readiness";
import { assertSameOrigin, consumeRateLimit } from "@/lib/request-security";
import { drawTeacherCollectionPurchase, TeacherCollectionPurchaseError } from "@/lib/teacher-collection-purchases";
import { z } from "zod";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const teacher = await requireTeacher();
    await requireCollectionPurchasesSchema();
    assertSameOrigin(request);
    await consumeRateLimit(`collection-purchase:draw:${teacher.id}`, 15, 10 * 60_000);
    const id = z.string().uuid().parse((await params).id);
    return NextResponse.json(await drawTeacherCollectionPurchase(teacher.id, id));
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "Compra inválida." }, { status: 400 });
    if (error instanceof TeacherCollectionPurchaseError) {
      const messages: Record<string, string> = {
        REQUEST_NOT_FOUND: "Compra não encontrada.",
        REQUEST_NOT_OPEN: "Esta compra não está mais aberta.",
        NO_ELIGIBLE_OFFERS: "Ainda não há ofertas válidas para sortear.",
        COLLECTION_CHANGED: "A coleção oferecida mudou. Tente novamente.",
      };
      return NextResponse.json({ message: messages[error.message] ?? "Não foi possível concluir o sorteio." }, { status: 409 });
    }
    const [message, status] = apiError(error);
    return NextResponse.json({ message }, { status });
  }
}
