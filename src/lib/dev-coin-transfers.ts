import type { Prisma } from "@/generated/prisma/client";
import { DEV_COIN_TRANSFER_XP_FEE, remainingWeeklyDevCoinTransfer, WEEKLY_DEV_COIN_TRANSFER_LIMIT } from "@/lib/dev-coins";
import { getSchoolWeek } from "@/lib/school-day";

type Tx = Prisma.TransactionClient;

export class DevCoinTransferError extends Error {}

export async function transferDevCoins(tx: Tx, senderId: string, recipientId: string, amount: number, requestId: string) {
  if (senderId === recipientId) throw new DevCoinTransferError("SELF_TRANSFER");
  const weekKey = getSchoolWeek().key;
  const idempotencyKey = `student-transfer:${senderId}:${requestId}`;

  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${senderId}::uuid FOR UPDATE`;
  const existing = await tx.devCoinTransfer.findUnique({
    where: { idempotencyKey },
    include: { recipient: { select: { firstName: true, lastName: true } } },
  });
  if (existing) {
    if (existing.recipientId !== recipientId || existing.amount !== amount) throw new DevCoinTransferError("IDEMPOTENCY_CONFLICT");
    const [sender, sent] = await Promise.all([
      tx.user.findUniqueOrThrow({ where: { id: senderId }, select: { xp: true, devCoins: true } }),
      tx.devCoinTransfer.aggregate({ where: { senderId, weekKey }, _sum: { amount: true } }),
    ]);
    return { transferId: existing.id, recipientName: `${existing.recipient.firstName} ${existing.recipient.lastName}`, amount, xpFee: existing.xpFee, xp: sender.xp, devCoins: sender.devCoins, remainingWeekly: remainingWeeklyDevCoinTransfer(sent._sum.amount ?? 0), replayed: true };
  }

  const [sender, recipient, sent] = await Promise.all([
    tx.user.findFirstOrThrow({ where: { id: senderId, role: "STUDENT", status: "ACTIVE" }, select: { firstName: true, lastName: true, xp: true, devCoins: true } }),
    tx.user.findFirst({ where: { id: recipientId, role: "STUDENT", status: "ACTIVE" }, select: { id: true, firstName: true, lastName: true } }),
    tx.devCoinTransfer.aggregate({ where: { senderId, weekKey }, _sum: { amount: true } }),
  ]);
  if (!recipient) throw new DevCoinTransferError("RECIPIENT_UNAVAILABLE");
  const sentThisWeek = sent._sum.amount ?? 0;
  if (sentThisWeek + amount > WEEKLY_DEV_COIN_TRANSFER_LIMIT) throw new DevCoinTransferError("WEEKLY_TRANSFER_LIMIT");
  if (sender.devCoins < amount) throw new DevCoinTransferError("INSUFFICIENT_DEV_COINS");
  if (sender.xp < DEV_COIN_TRANSFER_XP_FEE) throw new DevCoinTransferError("INSUFFICIENT_XP");

  const debit = await tx.user.updateMany({
    where: { id: senderId, role: "STUDENT", status: "ACTIVE", devCoins: { gte: amount }, xp: { gte: DEV_COIN_TRANSFER_XP_FEE } },
    data: { devCoins: { decrement: amount }, xp: { decrement: DEV_COIN_TRANSFER_XP_FEE } },
  });
  if (debit.count !== 1) throw new DevCoinTransferError("INSUFFICIENT_BALANCE");
  const credit = await tx.user.updateMany({ where: { id: recipient.id, role: "STUDENT", status: "ACTIVE" }, data: { devCoins: { increment: amount } } });
  if (credit.count !== 1) throw new DevCoinTransferError("RECIPIENT_UNAVAILABLE");

  const xpEntry = await tx.xpEntry.create({
    data: { studentId: senderId, delta: -DEV_COIN_TRANSFER_XP_FEE, reason: `Taxa de transferência para ${recipient.firstName} ${recipient.lastName}`, source: "DEV_COIN_TRANSFER", idempotencyKey: `${idempotencyKey}:xp` },
  });
  const senderEntry = await tx.devCoinEntry.create({
    data: { studentId: senderId, authorId: senderId, delta: -amount, reason: `Transferência enviada para ${recipient.firstName} ${recipient.lastName}`, source: "TRANSFER_SENT", idempotencyKey: `${idempotencyKey}:sender` },
  });
  const recipientEntry = await tx.devCoinEntry.create({
    data: { studentId: recipient.id, authorId: senderId, delta: amount, reason: `Transferência recebida de ${sender.firstName} ${sender.lastName}`, source: "TRANSFER_RECEIVED", idempotencyKey: `${idempotencyKey}:recipient` },
  });
  const transfer = await tx.devCoinTransfer.create({
    data: { senderId, recipientId: recipient.id, senderEntryId: senderEntry.id, recipientEntryId: recipientEntry.id, xpEntryId: xpEntry.id, amount, xpFee: DEV_COIN_TRANSFER_XP_FEE, weekKey, idempotencyKey },
  });
  await tx.auditLog.create({ data: { actorId: senderId, targetId: recipient.id, event: "DEV_COIN_TRANSFERRED", details: { transferId: transfer.id, amount, xpFee: DEV_COIN_TRANSFER_XP_FEE, weekKey } } });
  return { transferId: transfer.id, recipientName: `${recipient.firstName} ${recipient.lastName}`, amount, xpFee: DEV_COIN_TRANSFER_XP_FEE, xp: sender.xp - DEV_COIN_TRANSFER_XP_FEE, devCoins: sender.devCoins - amount, remainingWeekly: remainingWeeklyDevCoinTransfer(sentThisWeek + amount), replayed: false };
}
