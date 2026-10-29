import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireStudent } from "@/lib/authorization";
import { requireInvestmentsSchema } from "@/lib/feature-readiness";
import { InvestmentConflict, redeemInvestment } from "@/lib/investments";
import { assertSameOrigin, consumeRateLimit } from "@/lib/request-security";
import { verifyStudentPassword } from "@/lib/student-password";

const input = z.object({ requestId: z.string().uuid(), studentPassword: z.string().min(1).max(72) });

export async function POST(request: Request, context: RouteContext<"/api/student/investments/[id]/redeem">) {
  try {
    const { student } = await requireStudent();
    assertSameOrigin(request);
    await consumeRateLimit(`investment:redeem:${student.id}`, 12, 10 * 60_000);
    await requireInvestmentsSchema();
    const { id } = await context.params;
    const body = input.parse(await request.json());
    await verifyStudentPassword(body.studentPassword, student.passwordHash);
    const result = await redeemInvestment({ studentId: student.id, positionId: id, requestId: body.requestId });
    return NextResponse.json({ ok: true, payout: result.payout, dividends: result.dividends, devCoins: result.devCoins });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "Confirme sua senha para realizar o resgate." }, { status: 400 });
    if (error instanceof InvestmentConflict) {
      const messages: Record<string, string> = {
        INVESTMENT_LOCKED: "Este investimento ainda está no prazo mínimo.",
        INVESTMENT_ALREADY_REDEEMED: "Este investimento já foi resgatado.",
        INSUFFICIENT_REDEMPTION_GUARANTEE: "A garantia do fundo está temporariamente indisponível. Avise o professor.",
        REQUEST_ID_CONFLICT: "Esta solicitação não pôde ser reutilizada.",
      };
      return NextResponse.json({ message: messages[error.message] ?? "Não foi possível concluir o resgate.", current: error.current }, { status: 409 });
    }
    const [message, status] = apiError(error);
    return NextResponse.json({ message }, { status });
  }
}
