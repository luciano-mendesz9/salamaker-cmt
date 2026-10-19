import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireStudent } from "@/lib/authorization";
import { requireCollectionPurchasesSchema } from "@/lib/feature-readiness";
import { assertSameOrigin, consumeRateLimit } from "@/lib/request-security";
import { offerCompleteCollection, TeacherCollectionPurchaseError, withdrawCompleteCollectionOffer } from "@/lib/teacher-collection-purchases";

type Context = { params: Promise<{ requestId: string }> };
const requestIdSchema = z.string().uuid();

export async function POST(request: Request, { params }: Context) {
  try {
    const { student } = await requireStudent();
    await requireCollectionPurchasesSchema();
    assertSameOrigin(request);
    await consumeRateLimit(`collection-offer:create:${student.id}`, 20, 10 * 60_000);
    const requestId = requestIdSchema.parse((await params).requestId);
    const offer = await offerCompleteCollection(student.id, requestId);
    return NextResponse.json({ offer }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "Pedido de compra inválido." }, { status: 400 });
    if (error instanceof TeacherCollectionPurchaseError) {
      const messages: Record<string, string> = {
        REQUEST_NOT_OPEN: "Esta compra não está mais aberta.",
        COLLECTION_INCOMPLETE: "Você precisa ter uma cópia livre de cada figurinha publicada desta coleção.",
        COLLECTION_CHANGED: "Sua coleção mudou durante a oferta. Atualize a página e tente novamente.",
        OFFER_ALREADY_RESOLVED: "Esta oferta já foi encerrada.",
      };
      return NextResponse.json({ message: messages[error.message] ?? "Não foi possível oferecer a coleção." }, { status: 409 });
    }
    const [message, status] = apiError(error);
    return NextResponse.json({ message }, { status });
  }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    const { student } = await requireStudent();
    await requireCollectionPurchasesSchema();
    assertSameOrigin(request);
    await consumeRateLimit(`collection-offer:withdraw:${student.id}`, 20, 10 * 60_000);
    const requestId = requestIdSchema.parse((await params).requestId);
    return NextResponse.json(await withdrawCompleteCollectionOffer(student.id, requestId));
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "Pedido de compra inválido." }, { status: 400 });
    if (error instanceof TeacherCollectionPurchaseError) return NextResponse.json({ message: "Esta oferta não pode mais ser retirada." }, { status: 409 });
    const [message, status] = apiError(error);
    return NextResponse.json({ message }, { status });
  }
}
