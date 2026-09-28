import { randomUUID } from "node:crypto";
import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireTeacher } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { assertSameOrigin, consumeRateLimit } from "@/lib/request-security";
import { requireCollectiblesSchema } from "@/lib/feature-readiness";

const adjustment = z.object({
  action: z.enum(["MINT", "BURN"]),
  amount: z.number().int().positive().max(1_000_000),
  reason: z.string().trim().min(10).max(300),
  teacherPassword: z.string().min(1),
  expectedBalance: z.number().int().nonnegative(),
  expectedTotalSupply: z.number().int().nonnegative(),
  confirmed: z.literal(true),
});

export async function GET() {
  try {
    await requireTeacher();
    await requireCollectiblesSchema();
    const [treasury, circulation, entries] = await Promise.all([
      prisma.devCoinTreasury.findUniqueOrThrow({ where: { id: 1 } }),
      prisma.user.aggregate({ where: { role: "STUDENT" }, _sum: { devCoins: true } }),
      prisma.devCoinTreasuryEntry.findMany({ orderBy: { createdAt: "desc" }, take: 30, select: { id: true, delta: true, reason: true, source: true, createdAt: true } }),
    ]);
    const studentBalance = circulation._sum.devCoins ?? 0;
    return NextResponse.json({ treasury, studentBalance, invariantOk: treasury.totalSupply === treasury.balance + studentBalance, entries });
  } catch (error) {
    const [message, status] = apiError(error);
    return NextResponse.json({ message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const teacher = await requireTeacher();
    await requireCollectiblesSchema();
    assertSameOrigin(request);
    await consumeRateLimit(`treasury:adjust:${teacher.id}`, 10, 10 * 60_000);
    const body = adjustment.parse(await request.json());
    if (!(await compare(body.teacherPassword, teacher.passwordHash))) return NextResponse.json({ message: "Senha do professor incorreta." }, { status: 403 });

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.devCoinTreasury.findUniqueOrThrow({ where: { id: 1 } });
      if (current.balance !== body.expectedBalance || current.totalSupply !== body.expectedTotalSupply) throw new Error("TREASURY_CHANGED");
      if (body.action === "BURN" && current.balance < body.amount) throw new Error("INSUFFICIENT_TREASURY");
      const direction = body.action === "MINT" ? 1 : -1;
      const operationId = randomUUID();
      const treasury = await tx.devCoinTreasury.update({
        where: { id: 1 },
        data: { balance: { increment: direction * body.amount }, totalSupply: { increment: direction * body.amount } },
      });
      await tx.devCoinTreasuryEntry.create({ data: { authorId: teacher.id, delta: direction * body.amount, reason: body.reason, source: body.action === "MINT" ? "ADMIN_MINT" : "ADMIN_BURN", idempotencyKey: `treasury:${body.action.toLowerCase()}:${operationId}` } });
      await tx.auditLog.create({ data: { actorId: teacher.id, event: "DEV_COIN_TREASURY_CHANGED", details: { action: body.action, amount: body.amount, reason: body.reason, before: current, after: treasury, operationId } } });
      return treasury;
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ treasury: result });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "Revise quantidade, motivo, senha e confirmação." }, { status: 400 });
    if (error instanceof Error && error.message === "TREASURY_CHANGED") return NextResponse.json({ message: "O caixa mudou. Recarregue e confirme os novos valores." }, { status: 409 });
    if (error instanceof Error && error.message === "INSUFFICIENT_TREASURY") return NextResponse.json({ message: "O burn não pode exceder o saldo do caixa." }, { status: 409 });
    const [message, status] = apiError(error);
    return NextResponse.json({ message }, { status });
  }
}
