import type { Prisma } from "@/generated/prisma/client";
import { DEV_COIN_TO_XP_WINDOW_MS, devCoinToXpQuota, devCoinsRequiredForXp } from "@/lib/dev-coin-to-xp-policy";
import { creditTreasury } from "@/lib/treasury";

export class DevCoinToXpConflict extends Error {}

export async function convertDevCoinsToXp(tx: Prisma.TransactionClient, studentId: string, xpAmount: number, expectedRate: number, requestId: string) {
  const key = `dev-coin-to-xp:${studentId}:${requestId}`;
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${studentId}::uuid FOR UPDATE`;

  const existing = await tx.xpEntry.findUnique({ where: { idempotencyKey: key }, include: { devCoinEntry: true } });
  if (existing) {
    if (existing.studentId !== studentId || existing.delta !== xpAmount || existing.devCoinEntry?.delta !== -devCoinsRequiredForXp(xpAmount, expectedRate)) {
      throw new DevCoinToXpConflict("REQUEST_ID_CONFLICT");
    }
    const [student, entries] = await Promise.all([
      tx.user.findUniqueOrThrow({ where: { id: studentId }, select: { xp: true, devCoins: true } }),
      tx.xpEntry.findMany({ where: { studentId, source: "DEV_COIN_TO_XP", createdAt: { gt: new Date(Date.now() - DEV_COIN_TO_XP_WINDOW_MS) } }, select: { delta: true, createdAt: true } }),
    ]);
    return { xp: student.xp, devCoins: student.devCoins, xpReceived: xpAmount, devCoinsSpent: -existing.devCoinEntry.delta, quota: devCoinToXpQuota(entries, new Date()), replayed: true };
  }

  const now = new Date();
  const [student, settings, entries] = await Promise.all([
    tx.user.findFirstOrThrow({ where: { id: studentId, role: "STUDENT", status: "ACTIVE" }, select: { xp: true, devCoins: true } }),
    tx.appSetting.findUnique({ where: { id: 1 }, select: { devCoinsPerXp: true } }),
    tx.xpEntry.findMany({ where: { studentId, source: "DEV_COIN_TO_XP", createdAt: { gt: new Date(now.getTime() - DEV_COIN_TO_XP_WINDOW_MS) } }, select: { delta: true, createdAt: true } }),
  ]);
  const rate = settings?.devCoinsPerXp ?? 1;
  if (rate !== expectedRate) throw new DevCoinToXpConflict("RATE_CHANGED");
  const quota = devCoinToXpQuota(entries, now);
  if (xpAmount > quota.remaining) throw new DevCoinToXpConflict("QUOTA_EXCEEDED");
  const cost = devCoinsRequiredForXp(xpAmount, rate);
  if (student.devCoins < cost) throw new DevCoinToXpConflict("INSUFFICIENT_DEV_COINS");

  const debit = await tx.user.updateMany({
    where: { id: studentId, role: "STUDENT", status: "ACTIVE", devCoins: { gte: cost } },
    data: { devCoins: { decrement: cost }, xp: { increment: xpAmount } },
  });
  if (debit.count !== 1) throw new DevCoinToXpConflict("BALANCE_CHANGED");
  const xpEntry = await tx.xpEntry.create({ data: {
    studentId, authorId: studentId, delta: xpAmount,
    reason: `Conversão de ${cost} Dev-Coins em ${xpAmount} XP`,
    source: "DEV_COIN_TO_XP", idempotencyKey: key,
  } });
  const devCoinEntry = await tx.devCoinEntry.create({ data: {
    studentId, authorId: studentId, xpEntryId: xpEntry.id, delta: -cost,
    reason: `Conversão em ${xpAmount} XP`, source: "XP_CONVERSION_REDEMPTION",
    idempotencyKey: `${key}:dev-coins`,
  } });
  await creditTreasury(tx, cost, {
    reason: `Conversão de ${cost} Dev-Coins em ${xpAmount} XP`,
    source: "XP_CONVERSION_REDEMPTION", idempotencyKey: `${key}:treasury`, devCoinEntryId: devCoinEntry.id,
  });
  await tx.auditLog.create({ data: { actorId: studentId, targetId: studentId, event: "DEV_COIN_CONVERTED_TO_XP", details: { xpAmount, cost, rate, requestId } } });
  return {
    xp: student.xp + xpAmount,
    devCoins: student.devCoins - cost,
    xpReceived: xpAmount,
    devCoinsSpent: cost,
    quota: devCoinToXpQuota([...entries, xpEntry], now),
    replayed: false,
  };
}
