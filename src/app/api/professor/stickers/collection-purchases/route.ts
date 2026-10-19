import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireTeacher } from "@/lib/authorization";
import { requireCollectionPurchasesSchema } from "@/lib/feature-readiness";
import { assertSameOrigin, consumeRateLimit } from "@/lib/request-security";
import { createTeacherCollectionRequest, TeacherCollectionPurchaseError } from "@/lib/teacher-collection-purchases";

const input = z.object({ collectionId: z.string().uuid(), xpAmount: z.number().int().min(1).max(10_000) });

export async function POST(request: Request) {
  try {
    const teacher = await requireTeacher();
    await requireCollectionPurchasesSchema();
    assertSameOrigin(request);
    await consumeRateLimit(`collection-purchase:create:${teacher.id}`, 10, 10 * 60_000);
    const body = input.parse(await request.json());
    const purchaseRequest = await createTeacherCollectionRequest(teacher.id, body.collectionId, body.xpAmount);
    return NextResponse.json({ request: purchaseRequest }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "Escolha uma coleção ativa e informe de 1 a 10.000 XP." }, { status: 400 });
    if (error instanceof TeacherCollectionPurchaseError) {
      const messages: Record<string, string> = {
        COLLECTION_NOT_FOUND: "Coleção ativa não encontrada.",
        EMPTY_COLLECTION: "A coleção ainda não possui figurinhas publicadas.",
        REQUEST_ALREADY_OPEN: "Já existe uma compra aberta para esta coleção.",
        INVALID_XP_AMOUNT: "Informe de 1 a 10.000 XP.",
      };
      return NextResponse.json({ message: messages[error.message] ?? "Não foi possível abrir a compra." }, { status: 409 });
    }
    const [message, status] = apiError(error);
    return NextResponse.json({ message }, { status });
  }
}
