import type { Prisma } from "@/generated/prisma/client";

export class InsufficientTreasury extends Error {
  constructor() { super("INSUFFICIENT_TREASURY"); }
}

export async function debitTreasury(
  tx: Prisma.TransactionClient,
  amount: number,
  entry: { reason: string; source: "XP_CONVERSION" | "PATENT_REWARD" | "LUDO_SETTLEMENT"; idempotencyKey: string; devCoinEntryId?: string },
) {
  const changed = await tx.devCoinTreasury.updateMany({
    where: { id: 1, balance: { gte: amount } },
    data: { balance: { decrement: amount } },
  });
  if (changed.count !== 1) throw new InsufficientTreasury();
  await tx.devCoinTreasuryEntry.create({ data: { delta: -amount, ...entry } });
}

export async function creditTreasury(
  tx: Prisma.TransactionClient,
  amount: number,
  entry: { reason: string; source: "PLATFORM_PURCHASE" | "MARKET_FEE" | "LUDO_ROOM_FEE" | "LUDO_SETTLEMENT"; idempotencyKey: string; devCoinEntryId?: string },
) {
  await tx.devCoinTreasury.update({ where: { id: 1 }, data: { balance: { increment: amount } } });
  await tx.devCoinTreasuryEntry.create({ data: { delta: amount, ...entry } });
}
