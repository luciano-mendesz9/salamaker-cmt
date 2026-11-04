import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireStudent } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { DEV_COIN_TO_XP_LIMIT } from "@/lib/dev-coin-to-xp-policy";
import { convertDevCoinsToXp, DevCoinToXpConflict } from "@/lib/dev-coin-to-xp";
import { devCoinToXpSchemaReady, requireCollectiblesSchema } from "@/lib/feature-readiness";
import { assertSameOrigin, consumeRateLimit } from "@/lib/request-security";
import { verifyStudentPassword } from "@/lib/student-password";

const input = z.object({
  xpAmount: z.number().int().min(1).max(DEV_COIN_TO_XP_LIMIT),
  expectedRate: z.number().int().min(1).max(10_000),
  requestId: z.string().uuid(),
  studentPassword: z.string().min(1).max(72),
});

export async function POST(request: Request) {
  try {
    const { student } = await requireStudent();
    assertSameOrigin(request);
    await consumeRateLimit(`dev-coins:to-xp:${student.id}`, 12, 10 * 60_000);
    await requireCollectiblesSchema();
    if (!(await devCoinToXpSchemaReady())) return NextResponse.json({ message: "A conversão aguarda a atualização do banco de dados." }, { status: 503 });
    const body = input.parse(await request.json());
    await verifyStudentPassword(body.studentPassword, student.passwordHash);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const result = await prisma.$transaction(
          tx => convertDevCoinsToXp(tx, student.id, body.xpAmount, body.expectedRate, body.requestId),
          { isolationLevel: "Serializable", maxWait: 10_000, timeout: 20_000 },
        );
        return NextResponse.json(result);
      } catch (error) {
        if ((error as { code?: string }).code === "P2034" && attempt < 2) continue;
        throw error;
      }
    }
    throw new Error("TRANSACTION_RETRY_EXHAUSTED");
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "Escolha de 1 a 20 XP e informe sua senha." }, { status: 400 });
    if (error instanceof DevCoinToXpConflict) {
      const messages: Record<string, string> = {
        REQUEST_ID_CONFLICT: "Esta solicitação já foi usada com outros valores. Abra o formulário novamente.",
        RATE_CHANGED: "A cotação mudou. Atualize a página e confirme novamente.",
        QUOTA_EXCEEDED: "Seu limite de 20 XP em 48 horas foi atingido. Confira o relógio da sua carteira.",
        INSUFFICIENT_DEV_COINS: "Seu saldo de DevCoins é insuficiente.",
        BALANCE_CHANGED: "Seu saldo mudou. Atualize a página e tente novamente.",
      };
      return NextResponse.json({ message: messages[error.message] ?? "Não foi possível converter." }, { status: 409 });
    }
    const [message, status] = apiError(error);
    return NextResponse.json({ message }, { status });
  }
}
