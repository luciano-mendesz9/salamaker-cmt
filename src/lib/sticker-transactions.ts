import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getCollectiblesReadiness } from "@/lib/feature-readiness";
import { getSchoolDay } from "@/lib/school-day";
import { DAILY_STICKER_PACK_LIMIT, marketSplit, STICKER_PACK_PRICE, STICKERS_PER_PACK } from "@/lib/stickers";
import { assertStickerMarketEnabled } from "@/lib/sticker-market";
import { creditTreasury } from "@/lib/treasury";

type Tx = Prisma.TransactionClient;

export class StickerOperationError extends Error {}

export async function releaseExpiredStickerEscrows() {
  if (!(await getCollectiblesReadiness()).stickers) return false;
  const now = new Date();
  await prisma.$transaction(async tx => {
    await tx.$executeRaw`
      WITH expired AS (
        UPDATE "StickerListing" SET "state" = 'EXPIRED', "settledAt" = ${now}
        WHERE "state" = 'ACTIVE' AND "expiresAt" <= ${now}
        RETURNING "copyId"
      )
      UPDATE "StickerCopy" SET "state" = 'OWNED'
      WHERE "id" IN (SELECT "copyId" FROM expired) AND "state" = 'ESCROW'
    `;
    await tx.$executeRaw`
      WITH expired AS (
        UPDATE "StickerDonation" SET "state" = 'EXPIRED', "resolvedAt" = ${now}
        WHERE "state" = 'PENDING' AND "expiresAt" <= ${now}
        RETURNING "copyId"
      )
      UPDATE "StickerCopy" SET "state" = 'OWNED'
      WHERE "id" IN (SELECT "copyId" FROM expired) AND "state" = 'ESCROW'
    `;
  });
  return true;
}

async function lockRandomTreasuryCopies(tx: Tx, count: number) {
  return tx.$queryRaw<Array<{ id: string }>>`
    SELECT c."id"
    FROM "StickerCopy" c
    JOIN "Sticker" s ON s."id" = c."stickerId"
    WHERE c."state" = 'TREASURY' AND s."state" = 'PUBLISHED'
    ORDER BY random()
    LIMIT ${count}
    FOR UPDATE OF c SKIP LOCKED
  `;
}

async function allocatePack(tx: Tx, studentId: string, idempotencyKey: string, price: number) {
  const selected = await lockRandomTreasuryCopies(tx, STICKERS_PER_PACK);
  if (selected.length !== STICKERS_PER_PACK) throw new StickerOperationError("INSUFFICIENT_STICKER_STOCK");
  const schoolDay = getSchoolDay().key;
  const purchase = await tx.stickerPackPurchase.create({ data: { studentId, price, schoolDay, idempotencyKey } });
  const ids = selected.map(item => item.id);
  const changed = await tx.stickerCopy.updateMany({ where: { id: { in: ids }, state: "TREASURY", ownerId: null }, data: { ownerId: studentId, state: "OWNED", packPurchaseId: purchase.id, acquiredAt: new Date() } });
  if (changed.count !== STICKERS_PER_PACK) throw new StickerOperationError("STICKER_STOCK_RACE");
  const copies = await tx.stickerCopy.findMany({ where: { id: { in: ids } }, select: { id: true, stickerId: true, sticker: { select: { slug: true, name: true, imagePath: true, rarity: true, score: true } } } });
  await tx.sticker.updateMany({ where: { id: { in: copies.map(copy => copy.stickerId) }, firstDistributedAt: null }, data: { firstDistributedAt: new Date() } });
  return { purchase, copies };
}

export async function recalculatePatent(tx: Tx, studentId: string) {
  const owned = await tx.stickerCopy.findMany({ where: { ownerId: studentId, state: { in: ["OWNED", "ESCROW"] } }, distinct: ["stickerId"], select: { sticker: { select: { score: true } } } });
  const score = owned.reduce((sum, copy) => sum + copy.sticker.score, 0);
  const current = await tx.studentPatentProgress.findUnique({ where: { studentId } });
  const level = await tx.patentLevel.findFirst({ where: { threshold: { lte: score }, collection: { state: "ACTIVE" } }, orderBy: [{ rank: "desc" }, { version: "desc" }] });
  const bestRank = Math.max(current?.bestRank ?? 1, level?.rank ?? 1);
  const progress = await tx.studentPatentProgress.upsert({ where: { studentId }, create: { studentId, score, levelId: level?.id, bestRank }, update: { score, levelId: level?.id, bestRank } });
  const pendingClaims = await tx.patentRewardClaim.findMany({ where: { studentId, state: "PENDING" }, include: { patentLevel: true } });
  for (const claim of pendingClaims) {
    const dcRemaining = claim.patentLevel.devCoinReward - claim.devCoinsPaid;
    const packRemaining = claim.patentLevel.packReward - claim.packPaid;
    let dcPaid = claim.devCoinsPaid;
    let packPaid = claim.packPaid;
    if (dcRemaining > 0) {
      const treasury = await tx.devCoinTreasury.updateMany({ where: { id: 1, balance: { gte: dcRemaining } }, data: { balance: { decrement: dcRemaining } } });
      if (treasury.count === 1) {
        await tx.user.update({ where: { id: studentId }, data: { devCoins: { increment: dcRemaining } } });
        const entry = await tx.devCoinEntry.create({ data: { studentId, delta: dcRemaining, reason: `Recompensa pendente: ${claim.patentLevel.name}`, source: "PATENT_REWARD", idempotencyKey: `patent:${studentId}:${claim.patentLevelId}:dc:pending` } });
        await tx.devCoinTreasuryEntry.create({ data: { devCoinEntryId: entry.id, delta: -dcRemaining, reason: `Recompensa pendente: ${claim.patentLevel.name}`, source: "PATENT_REWARD", idempotencyKey: `patent:${studentId}:${claim.patentLevelId}:treasury:pending` } });
        dcPaid += dcRemaining;
      }
    }
    if (packRemaining > 0) {
      try { await allocatePack(tx, studentId, `patent:${studentId}:${claim.patentLevelId}:pack:pending`, 0); packPaid += 1; } catch (error) { if (!(error instanceof StickerOperationError)) throw error; }
    }
    const fullyPaid = dcPaid === claim.patentLevel.devCoinReward && packPaid === claim.patentLevel.packReward;
    await tx.patentRewardClaim.update({ where: { id: claim.id }, data: { devCoinsPaid: dcPaid, packPaid, state: fullyPaid ? "PAID" : "PENDING", paidAt: fullyPaid ? new Date() : null } });
  }
  if (!level || level.rank <= (current?.bestRank ?? 1)) return progress;

  const promotions = await tx.patentLevel.findMany({ where: { collectionId: level.collectionId, version: level.version, rank: { gt: current?.bestRank ?? 1, lte: level.rank } }, orderBy: { rank: "asc" } });
  for (const promotion of promotions) {
    const existing = await tx.patentRewardClaim.findUnique({ where: { studentId_patentLevelId: { studentId, patentLevelId: promotion.id } } });
    if (existing) continue;
    const rewardKey = `patent:${studentId}:${promotion.id}`;
    let devCoinsPaid = 0;
    let packPaid = 0;
    if (promotion.xpReward > 0) {
      await tx.user.update({ where: { id: studentId }, data: { xp: { increment: promotion.xpReward } } });
      await tx.xpEntry.create({ data: { studentId, delta: promotion.xpReward, reason: `Promoção para ${promotion.name}`, source: "SYSTEM", idempotencyKey: `${rewardKey}:xp` } });
    }
    if (promotion.devCoinReward > 0) {
      const treasury = await tx.devCoinTreasury.updateMany({ where: { id: 1, balance: { gte: promotion.devCoinReward } }, data: { balance: { decrement: promotion.devCoinReward } } });
      if (treasury.count === 1) {
        await tx.user.update({ where: { id: studentId }, data: { devCoins: { increment: promotion.devCoinReward } } });
        const entry = await tx.devCoinEntry.create({ data: { studentId, delta: promotion.devCoinReward, reason: `Promoção para ${promotion.name}`, source: "PATENT_REWARD", idempotencyKey: `${rewardKey}:dc` } });
        await tx.devCoinTreasuryEntry.create({ data: { devCoinEntryId: entry.id, delta: -promotion.devCoinReward, reason: `Promoção para ${promotion.name}`, source: "PATENT_REWARD", idempotencyKey: `${rewardKey}:treasury` } });
        devCoinsPaid = promotion.devCoinReward;
      }
    }
    if (promotion.packReward > 0) {
      try { await allocatePack(tx, studentId, `${rewardKey}:pack`, 0); packPaid = 1; } catch (error) { if (!(error instanceof StickerOperationError)) throw error; }
    }
    const fullyPaid = devCoinsPaid === promotion.devCoinReward && packPaid === promotion.packReward;
    await tx.patentRewardClaim.create({ data: { studentId, patentLevelId: promotion.id, state: fullyPaid ? "PAID" : "PENDING", xpPaid: promotion.xpReward, devCoinsPaid, packPaid, paidAt: fullyPaid ? new Date() : null } });
  }
  return progress;
}

export async function purchaseStickerPack(tx: Tx, studentId: string) {
  const schoolDay = getSchoolDay().key;
  const boughtToday = await tx.stickerPackPurchase.count({ where: { studentId, schoolDay, price: { gt: 0 } } });
  if (boughtToday >= DAILY_STICKER_PACK_LIMIT) throw new StickerOperationError("DAILY_PACK_LIMIT");
  const student = await tx.user.findFirstOrThrow({ where: { id: studentId, role: "STUDENT", status: "ACTIVE" }, select: { devCoins: true } });
  const debit = await tx.user.updateMany({ where: { id: studentId, devCoins: { gte: STICKER_PACK_PRICE } }, data: { devCoins: { decrement: STICKER_PACK_PRICE } } });
  if (debit.count !== 1) throw new StickerOperationError("INSUFFICIENT_DEV_COINS");
  const operationId = randomUUID();
  const entry = await tx.devCoinEntry.create({ data: { studentId, delta: -STICKER_PACK_PRICE, reason: "Compra de Pacote Maker", source: "STICKER_PACK", idempotencyKey: `sticker-pack:${operationId}` } });
  await creditTreasury(tx, STICKER_PACK_PRICE, { reason: "Compra de Pacote Maker", source: "PLATFORM_PURCHASE", idempotencyKey: `treasury:sticker-pack:${operationId}`, devCoinEntryId: entry.id });
  const result = await allocatePack(tx, studentId, `sticker-pack-purchase:${operationId}`, STICKER_PACK_PRICE);
  const progress = await recalculatePatent(tx, studentId);
  await tx.auditLog.create({ data: { actorId: studentId, targetId: studentId, event: "STICKER_PACK_PURCHASED", details: { purchaseId: result.purchase.id, price: STICKER_PACK_PRICE, copyIds: result.copies.map(copy => copy.id) } } });
  return { ...result, progress, devCoins: student.devCoins - STICKER_PACK_PRICE, remainingToday: DAILY_STICKER_PACK_LIMIT - boughtToday - 1 };
}

export async function settleListing(tx: Tx, listingId: string, buyerId: string) {
  await assertStickerMarketEnabled(tx);
  await tx.$queryRaw`SELECT "id" FROM "StickerListing" WHERE "id" = ${listingId}::uuid FOR UPDATE`;
  const listing = await tx.stickerListing.findUniqueOrThrow({ where: { id: listingId }, include: { copy: { include: { sticker: true } }, seller: { select: { status: true } } } });
  if (listing.state !== "ACTIVE" || listing.expiresAt <= new Date()) throw new StickerOperationError("LISTING_UNAVAILABLE");
  if (listing.copy.state !== "ESCROW" || listing.copy.ownerId !== listing.sellerId) throw new StickerOperationError("LISTING_UNAVAILABLE");
  if (listing.sellerId === buyerId) throw new StickerOperationError("OWN_LISTING");
  if (listing.seller.status !== "ACTIVE") throw new StickerOperationError("LISTING_UNAVAILABLE");
  if (await tx.stickerCopy.count({ where: { ownerId: buyerId, stickerId: listing.copy.stickerId } })) throw new StickerOperationError("ALREADY_OWNED");
  const buyerDebit = await tx.user.updateMany({ where: { id: buyerId, role: "STUDENT", status: "ACTIVE", devCoins: { gte: listing.price } }, data: { devCoins: { decrement: listing.price } } });
  if (buyerDebit.count !== 1) throw new StickerOperationError("INSUFFICIENT_DEV_COINS");
  const { sellerAmount, fee } = marketSplit(listing.price);
  await tx.user.update({ where: { id: listing.sellerId }, data: { devCoins: { increment: sellerAmount } } });
  const buyerEntry = await tx.devCoinEntry.create({ data: { studentId: buyerId, delta: -listing.price, reason: `Compra da figurinha ${listing.copy.sticker.name}`, source: "STICKER_MARKET", idempotencyKey: `sticker-market:${listing.id}:buyer` } });
  await tx.devCoinEntry.create({ data: { studentId: listing.sellerId, delta: sellerAmount, reason: `Venda da figurinha ${listing.copy.sticker.name}`, source: "STICKER_MARKET", idempotencyKey: `sticker-market:${listing.id}:seller` } });
  await creditTreasury(tx, fee, { reason: `Taxa do mercado da figurinha ${listing.copy.sticker.name}`, source: "MARKET_FEE", idempotencyKey: `treasury:sticker-market:${listing.id}`, devCoinEntryId: buyerEntry.id });
  await tx.stickerCopy.update({ where: { id: listing.copyId }, data: { ownerId: buyerId, state: "OWNED", acquiredAt: new Date() } });
  await tx.stickerListing.update({ where: { id: listing.id }, data: { state: "SOLD", buyerId, settledAt: new Date() } });
  await tx.stickerTrade.create({ data: { listingId: listing.id, sellerId: listing.sellerId, buyerId, price: listing.price, sellerAmount, fee } });
  await tx.auditLog.create({ data: { actorId: buyerId, targetId: listing.sellerId, event: "STICKER_TRADED", details: { listingId: listing.id, copyId: listing.copyId, price: listing.price, sellerAmount, fee } } });
  await recalculatePatent(tx, buyerId);
  return { sticker: listing.copy.sticker.name, price: listing.price };
}
