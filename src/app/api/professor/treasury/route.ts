import { randomUUID } from "node:crypto";
import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireTeacher } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { assertSameOrigin, consumeRateLimit } from "@/lib/request-security";
import { getCollectiblesReadiness, requireCollectiblesSchema } from "@/lib/feature-readiness";
import { maximumInvestmentPayout, requiredGuarantee } from "@/lib/investment-rules";

const adjustment = z.object({
  action: z.enum(["MINT", "BURN", "RESERVE_MINT", "RESERVE_BURN"]),
  amount: z.number().int().positive().max(1_000_000),
  reason: z.string().trim().min(10).max(300),
  teacherPassword: z.string().min(1),
  expectedBalance: z.number().int().nonnegative(),
  expectedTotalSupply: z.number().int().nonnegative(),
  expectedGuaranteeBalance: z.number().int().nonnegative(),
  confirmed: z.literal(true),
});

export async function GET() {
  try {
    await requireTeacher();
    await requireCollectiblesSchema();
    const readiness = await getCollectiblesReadiness();
    const [treasury, circulation, entries, fund] = await Promise.all([
      prisma.devCoinTreasury.findUniqueOrThrow({ where: { id: 1 } }),
      prisma.user.aggregate({ where: { role: "STUDENT" }, _sum: { devCoins: true } }),
      prisma.devCoinTreasuryEntry.findMany({ orderBy: { createdAt: "desc" }, take: 30, select: { id: true, delta: true, reason: true, source: true, createdAt: true } }),
      readiness.investments ? prisma.investmentFund.findUnique({ where: { id: 1 }, select: { balance: true, targetBalance: true, coverageBps: true } }) : Promise.resolve(null),
    ]);
    const studentBalance = circulation._sum.devCoins ?? 0;
    const guaranteeBalance = fund?.balance ?? 0;
    return NextResponse.json({ treasury, fund, studentBalance, invariantOk: treasury.totalSupply === treasury.balance + guaranteeBalance + studentBalance, entries });
  } catch (error) {
    const [message, status] = apiError(error);
    return NextResponse.json({ message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const teacher = await requireTeacher();
    await requireCollectiblesSchema();
    const readiness = await getCollectiblesReadiness();
    assertSameOrigin(request);
    await consumeRateLimit(`treasury:adjust:${teacher.id}`, 10, 10 * 60_000);
    const body = adjustment.parse(await request.json());
    const reserveAction = body.action === "RESERVE_MINT" || body.action === "RESERVE_BURN";
    if (reserveAction && !readiness.investments) throw new Error("INVESTMENTS_SCHEMA_NOT_READY");
    if (!(await compare(body.teacherPassword, teacher.passwordHash))) return NextResponse.json({ message: "Senha do professor incorreta." }, { status: 403 });

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "DevCoinTreasury" WHERE "id" = 1 FOR UPDATE`;
      if (readiness.investments) await tx.$queryRaw`SELECT "id" FROM "InvestmentFund" WHERE "id" = 1 FOR UPDATE`;
      const current = await tx.devCoinTreasury.findUniqueOrThrow({ where: { id: 1 } });
      const fund = readiness.investments ? await tx.investmentFund.findUniqueOrThrow({ where: { id: 1 } }) : null;
      const studentBalances = await tx.user.aggregate({ where: { role: "STUDENT" }, _sum: { devCoins: true } });
      if (current.balance !== body.expectedBalance || current.totalSupply !== body.expectedTotalSupply) throw new Error("TREASURY_CHANGED");
      if ((fund?.balance ?? 0) !== body.expectedGuaranteeBalance) throw new Error("TREASURY_CHANGED");
      const invariantGap = current.totalSupply - current.balance - (fund?.balance ?? 0) - (studentBalances._sum.devCoins ?? 0);
      if (invariantGap !== 0 && body.action !== "RESERVE_MINT") throw new Error("TREASURY_RECONCILIATION_REQUIRED");
      if (body.action === "BURN" && current.balance < body.amount) throw new Error("INSUFFICIENT_TREASURY");
      if (body.action === "RESERVE_BURN" && (!fund || fund.balance < body.amount)) throw new Error("INSUFFICIENT_INVESTMENT_RESERVE");
      if (body.action === "RESERVE_BURN" && fund) {
        const active = await tx.investmentPosition.findMany({ where: { status: "ACTIVE" }, select: { principal: true, weeklyRateBps: true } });
        const liability = active.reduce((total, position) => total + maximumInvestmentPayout(position.principal, position.weeklyRateBps), 0);
        if (fund.balance - body.amount < requiredGuarantee(liability, fund.coverageBps)) throw new Error("INVESTMENT_RESERVE_COMMITTED");
      }
      const minting = body.action === "MINT" || body.action === "RESERVE_MINT";
      const direction = minting ? 1 : -1;
      const operationId = randomUUID();
      const treasury = await tx.devCoinTreasury.update({
        where: { id: 1 },
        data: { ...(reserveAction ? {} : { balance: { increment: direction * body.amount } }), totalSupply: { increment: direction * body.amount } },
      });
      let investmentFund = fund;
      if (reserveAction) {
        investmentFund = await tx.investmentFund.update({ where: { id: 1 }, data: { balance: { increment: direction * body.amount } } });
        await tx.investmentReserveEntry.create({ data: { authorId: teacher.id, delta: direction * body.amount, reason: body.reason, source: body.action === "RESERVE_MINT" ? "ADMIN_MINT" : "ADMIN_BURN", idempotencyKey: `investment-reserve:${body.action.toLowerCase()}:${operationId}` } });
        await tx.auditLog.create({ data: { actorId: teacher.id, event: "INVESTMENT_RESERVE_CHANGED", details: { action: body.action, amount: body.amount, reason: body.reason, before: fund, after: investmentFund, totalSupplyBefore: current.totalSupply, totalSupplyAfter: treasury.totalSupply, operationId } } });
      } else {
        await tx.devCoinTreasuryEntry.create({ data: { authorId: teacher.id, delta: direction * body.amount, reason: body.reason, source: body.action === "MINT" ? "ADMIN_MINT" : "ADMIN_BURN", idempotencyKey: `treasury:${body.action.toLowerCase()}:${operationId}` } });
        await tx.auditLog.create({ data: { actorId: teacher.id, event: "DEV_COIN_TREASURY_CHANGED", details: { action: body.action, amount: body.amount, reason: body.reason, before: current, after: treasury, operationId } } });
      }
      return { treasury, fund: investmentFund };
    }, { isolationLevel: "Serializable" });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "Revise quantidade, motivo, senha e confirmação." }, { status: 400 });
    if (error instanceof Error && error.message === "TREASURY_CHANGED") return NextResponse.json({ message: "O caixa mudou. Recarregue e confirme os novos valores." }, { status: 409 });
    if (error instanceof Error && error.message === "TREASURY_RECONCILIATION_REQUIRED") return NextResponse.json({ message: "A invariante da tesouraria precisa ser reconciliada antes desta operação. O mint da reserva continua disponível porque não altera a divergência." }, { status: 409 });
    if (error instanceof Error && error.message === "INSUFFICIENT_TREASURY") return NextResponse.json({ message: "O burn não pode exceder o saldo do caixa." }, { status: 409 });
    if (error instanceof Error && error.message === "INSUFFICIENT_INVESTMENT_RESERVE") return NextResponse.json({ message: "O burn não pode exceder a reserva de investimentos." }, { status: 409 });
    if (error instanceof Error && error.message === "INVESTMENT_RESERVE_COMMITTED") return NextResponse.json({ message: "Esta parte da reserva já garante investimentos ativos e não pode ser removida." }, { status: 409 });
    const [message, status] = apiError(error);
    return NextResponse.json({ message }, { status });
  }
}
