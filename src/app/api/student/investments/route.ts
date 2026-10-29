import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireStudent } from "@/lib/authorization";
import { requireInvestmentsSchema } from "@/lib/feature-readiness";
import { applyInvestment, InvestmentConflict } from "@/lib/investments";
import { INVESTMENT_PRODUCTS, isValidInvestmentAmount, MAX_DAILY_INVESTMENT } from "@/lib/investment-rules";
import { assertSameOrigin, consumeRateLimit } from "@/lib/request-security";
import { verifyStudentPassword } from "@/lib/student-password";

const productKeys = INVESTMENT_PRODUCTS.map((product) => product.key) as ["MAKER_SAVINGS", "MAKER_BOND", "MAKER_BOND_PLUS"];
const input = z.object({
  product: z.enum(productKeys),
  amount: z.number().int().min(1).max(MAX_DAILY_INVESTMENT),
  requestId: z.string().uuid(),
  studentPassword: z.string().min(1).max(72),
}).superRefine((value, context) => {
  if (!isValidInvestmentAmount(value.product, value.amount)) context.addIssue({ code: "custom", path: ["amount"], message: "Valor inválido para este produto." });
});

export async function POST(request: Request) {
  try {
    const { student } = await requireStudent();
    assertSameOrigin(request);
    await consumeRateLimit(`investment:apply:${student.id}`, 12, 10 * 60_000);
    await requireInvestmentsSchema();
    const body = input.parse(await request.json());
    await verifyStudentPassword(body.studentPassword, student.passwordHash);
    const result = await applyInvestment({ studentId: student.id, product: body.product, amount: body.amount, requestId: body.requestId });
    return NextResponse.json({ ok: true, xp: result.xp, devCoins: result.devCoins, positionId: result.position.id });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "No Cofrinho, escolha de 1 a 1.000 DC. Nos Títulos, escolha cotas inteiras de 1.000 DC." }, { status: 400 });
    if (error instanceof InvestmentConflict) {
      const messages: Record<string, string> = {
        INSUFFICIENT_DEV_COINS: "Você não possui Dev-Coins suficientes para esta aplicação.",
        INSUFFICIENT_XP: "Você não possui XP suficiente para pagar a taxa desta aplicação.",
        DAILY_INVESTMENT_LIMIT: "O limite diário é de 3.000 Dev-Coins.",
        INSUFFICIENT_INVESTMENT_CAPACITY: "A reserva de garantia atingiu o limite seguro para novas aplicações.",
        BALANCE_CHANGED: "Seu saldo mudou. Atualize a página e tente novamente.",
        REQUEST_ID_CONFLICT: "Esta solicitação não pôde ser reutilizada.",
      };
      return NextResponse.json({ message: messages[error.message] ?? "Não foi possível concluir a aplicação.", current: error.current }, { status: 409 });
    }
    if (error instanceof Error && error.message === "DAILY_INVESTMENT_LIMIT") return NextResponse.json({ message: "O limite diário é de 3.000 Dev-Coins." }, { status: 409 });
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2004") {
      return NextResponse.json({ message: "A atualização do banco para valores personalizados do Cofrinho ainda não foi aplicada." }, { status: 503 });
    }
    const [message, status] = apiError(error);
    return NextResponse.json({ message }, { status });
  }
}
