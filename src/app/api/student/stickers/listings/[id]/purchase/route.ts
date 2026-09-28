import { NextResponse } from "next/server";
import { apiError, requireStudent } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { settleListing, StickerOperationError } from "@/lib/sticker-transactions";
import { assertSameOrigin, consumeRateLimit } from "@/lib/request-security";
import { requireCollectiblesSchema } from "@/lib/feature-readiness";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { student } = await requireStudent();
    await requireCollectiblesSchema();
    assertSameOrigin(request);
    await consumeRateLimit(`stickers:buy:${student.id}`, 20, 10 * 60_000);
    const { id } = await context.params;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try { return NextResponse.json(await prisma.$transaction(tx => settleListing(tx, id, student.id), { isolationLevel: "Serializable" })); }
      catch (error) { if ((error as { code?: string }).code === "P2034" && attempt < 2) continue; throw error; }
    }
    throw new Error("TRANSACTION_RETRY_EXHAUSTED");
  } catch (error) {
    if (error instanceof StickerOperationError) {
      const messages: Record<string,string> = { LISTING_UNAVAILABLE: "O anúncio não está mais disponível.", OWN_LISTING: "Você não pode comprar o próprio anúncio.", ALREADY_OWNED: "Você já possui esta figurinha.", INSUFFICIENT_DEV_COINS: "Saldo de Dev-Coins insuficiente." };
      return NextResponse.json({ message: messages[error.message] ?? "Não foi possível concluir a compra." }, { status: 409 });
    }
    const [message,status]=apiError(error); return NextResponse.json({message},{status});
  }
}
