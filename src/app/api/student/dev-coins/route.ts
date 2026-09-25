import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireStudent } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { devCoinsForXp } from "@/lib/dev-coins";

const input = z.object({
  xpAmount: z.number().int().min(1).max(10_000),
  expectedRate: z.number().int().min(1).max(10_000),
});

class DevCoinRateChanged extends Error {
  constructor(public readonly rate: number) {
    super("DEV_COIN_RATE_CHANGED");
  }
}

class InsufficientXp extends Error {
  constructor(public readonly xp: number) {
    super("INSUFFICIENT_XP");
  }
}

async function purchaseDevCoins(studentId: string, xpAmount: number, expectedRate: number) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const [student, settings] = await Promise.all([
          tx.user.findFirstOrThrow({
            where: { id: studentId, role: "STUDENT", status: "ACTIVE" },
            select: { xp: true, devCoins: true },
          }),
          tx.appSetting.upsert({
            where: { id: 1 },
            create: { id: 1 },
            update: {},
            select: { devCoinsPerXp: true },
          }),
        ]);

        if (settings.devCoinsPerXp !== expectedRate) throw new DevCoinRateChanged(settings.devCoinsPerXp);
        const quantity = devCoinsForXp(xpAmount, settings.devCoinsPerXp);
        const debit = await tx.user.updateMany({
          where: { id: studentId, role: "STUDENT", status: "ACTIVE", xp: { gte: xpAmount } },
          data: { xp: { decrement: xpAmount }, devCoins: { increment: quantity } },
        });
        if (debit.count !== 1) throw new InsufficientXp(student.xp);

        const operationId = randomUUID();
        const xpEntry = await tx.xpEntry.create({
          data: {
            studentId,
            delta: -xpAmount,
            reason: `Compra de ${quantity} Dev-Coin${quantity === 1 ? "" : "s"}`,
            source: "DEV_COIN_PURCHASE",
            idempotencyKey: `dev-coin-purchase-xp:${operationId}`,
          },
        });
        await tx.devCoinEntry.create({
          data: {
            studentId,
            xpEntryId: xpEntry.id,
            delta: quantity,
            reason: `Compra com ${xpAmount} XP`,
            source: "PURCHASE",
            idempotencyKey: `dev-coin-purchase:${operationId}`,
          },
        });

        return {
          devCoins: student.devCoins + quantity,
          xp: student.xp - xpAmount,
          quantity,
          xpCost: xpAmount,
          rate: settings.devCoinsPerXp,
        };
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if ((error as { code?: string }).code === "P2034" && attempt < 2) continue;
      throw error;
    }
  }
  throw new Error("TRANSACTION_RETRY_EXHAUSTED");
}

export async function POST(request: Request) {
  try {
    const { student } = await requireStudent();
    const { xpAmount, expectedRate } = input.parse(await request.json());
    return NextResponse.json(await purchaseDevCoins(student.id, xpAmount, expectedRate));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Informe uma quantidade válida de XP para trocar." }, { status: 400 });
    }
    if (error instanceof DevCoinRateChanged) {
      return NextResponse.json({ message: "A cotação mudou. Confira o novo valor e confirme novamente.", rate: error.rate }, { status: 409 });
    }
    if (error instanceof InsufficientXp) {
      return NextResponse.json({ message: "Você não tem XP suficiente para esta compra.", xp: error.xp }, { status: 409 });
    }
    const [message, status] = apiError(error);
    return NextResponse.json({ message }, { status });
  }
}
