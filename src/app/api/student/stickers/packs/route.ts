import { NextResponse } from "next/server";
import { apiError, requireStudent } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { purchaseStickerPack, StickerOperationError } from "@/lib/sticker-transactions";
import { assertSameOrigin, consumeRateLimit } from "@/lib/request-security";
import { requireCollectiblesSchema } from "@/lib/feature-readiness";
import { z } from "zod";
import { verifyStudentPassword } from "@/lib/student-password";

const input = z.object({ studentPassword: z.string().min(1).max(72) });

export async function POST(request: Request) {
  try {
    const { student } = await requireStudent();
    await requireCollectiblesSchema();
    assertSameOrigin(request);
    await consumeRateLimit(`stickers:pack:${student.id}`, 8, 10 * 60_000);
    const body = input.parse(await request.json().catch(() => ({})));
    await verifyStudentPassword(body.studentPassword, student.passwordHash);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const result = await prisma.$transaction(tx => purchaseStickerPack(tx, student.id), {
          isolationLevel: "Serializable",
          maxWait: 10_000,
          timeout: 20_000,
        });
        return NextResponse.json(result);
      } catch (error) {
        if ((error as { code?: string }).code === "P2034" && attempt < 2) continue;
        throw error;
      }
    }
    throw new Error("TRANSACTION_RETRY_EXHAUSTED");
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "Informe sua senha para abrir o pacote." }, { status: 400 });
    if (error instanceof StickerOperationError) {
      const messages: Record<string, string> = { DAILY_PACK_LIMIT: "Você já comprou cinco pacotes neste dia escolar.", INSUFFICIENT_DEV_COINS: "Saldo de Dev-Coins insuficiente.", INSUFFICIENT_STICKER_STOCK: "Há menos de três cópias elegíveis no caixa." };
      return NextResponse.json({ message: messages[error.message] ?? "O estoque mudou. Tente novamente." }, { status: 409 });
    }
    if ((error as { code?: string }).code === "P2028") {
      return NextResponse.json({ message: "O banco demorou para concluir a compra. Nenhum DC foi debitado; tente novamente." }, { status: 503 });
    }
    const [message, status] = apiError(error);
    return NextResponse.json({ message }, { status });
  }
}
