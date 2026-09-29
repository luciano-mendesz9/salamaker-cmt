import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireStudent } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { DevCoinTransferError, transferDevCoins } from "@/lib/dev-coin-transfers";
import { assertSameOrigin, consumeRateLimit } from "@/lib/request-security";
import { verifyStudentPassword } from "@/lib/student-password";

const input = z.object({
  recipientId: z.string().uuid(),
  amount: z.number().int().min(1).max(300),
  requestId: z.string().uuid(),
  studentPassword: z.string().min(1).max(72),
});

export async function POST(request: Request) {
  try {
    const { student } = await requireStudent();
    assertSameOrigin(request);
    await consumeRateLimit(`dev-coins:transfer:${student.id}`, 12, 10 * 60_000);
    const body = input.parse(await request.json());
    await verifyStudentPassword(body.studentPassword, student.passwordHash);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const result = await prisma.$transaction(tx => transferDevCoins(tx, student.id, body.recipientId, body.amount, body.requestId), { isolationLevel: "Serializable", maxWait: 10_000, timeout: 20_000 });
        return NextResponse.json(result);
      } catch (error) {
        if ((error as { code?: string }).code === "P2034" && attempt < 2) continue;
        throw error;
      }
    }
    throw new Error("TRANSACTION_RETRY_EXHAUSTED");
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "Revise o colega, o valor e a senha." }, { status: 400 });
    if (error instanceof DevCoinTransferError) {
      const messages: Record<string, string> = {
        SELF_TRANSFER: "Você não pode transferir Dev-Coins para a própria conta.",
        RECIPIENT_UNAVAILABLE: "O colega selecionado não está disponível.",
        WEEKLY_TRANSFER_LIMIT: "Esta transferência ultrapassa o limite semanal de 300 Dev-Coins.",
        INSUFFICIENT_DEV_COINS: "Saldo de Dev-Coins insuficiente.",
        INSUFFICIENT_XP: "Você precisa ter pelo menos 5 XP para pagar a taxa da transferência.",
        INSUFFICIENT_BALANCE: "Seu saldo mudou. Confira os valores e tente novamente.",
        IDEMPOTENCY_CONFLICT: "Esta solicitação já foi usada com outros dados. Abra o formulário novamente.",
      };
      return NextResponse.json({ message: messages[error.message] ?? "Não foi possível transferir." }, { status: 409 });
    }
    if ((error as { code?: string }).code === "P2021") return NextResponse.json({ message: "A transferência aguarda a atualização do banco de dados." }, { status: 503 });
    const [message, status] = apiError(error);
    return NextResponse.json({ message }, { status });
  }
}
