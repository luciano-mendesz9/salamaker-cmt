import "server-only";
import { randomInt } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { recalculatePatent } from "@/lib/sticker-transactions";
import { suggestedCollectionXp } from "@/lib/stickers";

type Tx = Prisma.TransactionClient;

export class TeacherCollectionPurchaseError extends Error {}

function assertXpAmount(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > 10_000) {
    throw new TeacherCollectionPurchaseError("INVALID_XP_AMOUNT");
  }
}

async function serializable<T>(operation: (tx: Tx) => Promise<T>) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: "Serializable",
        maxWait: 10_000,
        timeout: 20_000,
      });
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
      if (code !== "P2034" || attempt === 2) throw error;
    }
  }
  throw new TeacherCollectionPurchaseError("TRANSACTION_FAILED");
}

async function lockRequest(tx: Tx, requestId: string) {
  await tx.$queryRaw`SELECT "id" FROM "TeacherCollectionPurchaseRequest" WHERE "id" = ${requestId}::uuid FOR UPDATE`;
  return tx.teacherCollectionPurchaseRequest.findUnique({
    where: { id: requestId },
    include: { collection: { include: { stickers: { where: { state: "PUBLISHED" }, select: { id: true, score: true } } } } },
  });
}

function requestNotificationBody(collectionName: string, xpAmount: number) {
  return `O professor oferece ${xpAmount} XP por uma unidade completa da coleção ${collectionName}. Se você tiver uma cópia livre de cada figurinha publicada, abra o álbum e clique em “Oferecer”. A roleta escolherá uma das ofertas válidas.`;
}

export async function createTeacherCollectionRequest(teacherId: string, collectionId: string, xpAmount: number) {
  assertXpAmount(xpAmount);
  return serializable(async tx => {
    const collection = await tx.stickerCollection.findFirst({
      where: { id: collectionId, state: "ACTIVE" },
      include: { stickers: { where: { state: "PUBLISHED" }, select: { id: true, score: true } } },
    });
    if (!collection) throw new TeacherCollectionPurchaseError("COLLECTION_NOT_FOUND");
    if (collection.stickers.length === 0) throw new TeacherCollectionPurchaseError("EMPTY_COLLECTION");
    const suggestedXp = suggestedCollectionXp(collection.stickers.map(sticker => sticker.score));
    const open = await tx.teacherCollectionPurchaseRequest.findFirst({ where: { collectionId, state: "OPEN" }, select: { id: true } });
    if (open) throw new TeacherCollectionPurchaseError("REQUEST_ALREADY_OPEN");

    const notification = await tx.notification.create({
      data: {
        title: `Professor quer comprar: ${collection.name}`,
        body: requestNotificationBody(collection.name, xpAmount),
        kind: "INBOX",
        linkPath: "/aluno/album",
        authorId: teacherId,
      },
    });
    const created = await tx.teacherCollectionPurchaseRequest.create({
      data: { teacherId, collectionId, notificationId: notification.id, suggestedXp, xpAmount },
    });
    await tx.auditLog.create({
      data: {
        actorId: teacherId,
        event: "STICKER_COLLECTION_REQUEST_CREATED",
        details: { requestId: created.id, collectionId, suggestedXp, xpAmount },
      },
    });
    return created;
  });
}

export async function updateTeacherCollectionRequest(teacherId: string, requestId: string, xpAmount: number) {
  assertXpAmount(xpAmount);
  return serializable(async tx => {
    const request = await lockRequest(tx, requestId);
    if (!request || request.teacherId !== teacherId) throw new TeacherCollectionPurchaseError("REQUEST_NOT_FOUND");
    if (request.state !== "OPEN") throw new TeacherCollectionPurchaseError("REQUEST_NOT_OPEN");
    const updated = await tx.teacherCollectionPurchaseRequest.update({ where: { id: requestId }, data: { xpAmount } });
    if (request.notificationId) {
      await tx.notification.update({
        where: { id: request.notificationId },
        data: { body: requestNotificationBody(request.collection.name, xpAmount) },
      });
    }
    await tx.auditLog.create({
      data: {
        actorId: teacherId,
        event: "STICKER_COLLECTION_REQUEST_UPDATED",
        details: { requestId, collectionId: request.collectionId, suggestedXp: request.suggestedXp, xpAmount, action: "PRICE_UPDATED" },
      },
    });
    return updated;
  });
}

export async function cancelTeacherCollectionRequest(teacherId: string, requestId: string) {
  return serializable(async tx => {
    const request = await lockRequest(tx, requestId);
    if (!request || request.teacherId !== teacherId) throw new TeacherCollectionPurchaseError("REQUEST_NOT_FOUND");
    if (request.state !== "OPEN") throw new TeacherCollectionPurchaseError("REQUEST_NOT_OPEN");
    const offers = await tx.teacherCollectionOffer.findMany({
      where: { requestId, state: "ACTIVE" },
      include: { copies: { select: { copyId: true } } },
    });
    const copyIds = offers.flatMap(offer => offer.copies.map(item => item.copyId));
    if (copyIds.length) await tx.stickerCopy.updateMany({ where: { id: { in: copyIds }, state: "ESCROW" }, data: { state: "OWNED" } });
    await tx.teacherCollectionOffer.updateMany({ where: { requestId, state: "ACTIVE" }, data: { state: "WITHDRAWN", resolvedAt: new Date() } });
    await tx.teacherCollectionPurchaseRequest.update({ where: { id: requestId }, data: { state: "CANCELLED", resolvedAt: new Date() } });
    if (request.notificationId) {
      await tx.notification.update({ where: { id: request.notificationId }, data: { body: `A compra da coleção ${request.collection.name} foi cancelada pelo professor. Nenhuma figurinha foi transferida.` } });
    }
    await tx.auditLog.create({
      data: { actorId: teacherId, event: "STICKER_COLLECTION_REQUEST_CANCELLED", details: { requestId, releasedOffers: offers.length, releasedCopies: copyIds.length } },
    });
    return { releasedOffers: offers.length };
  });
}

export async function offerCompleteCollection(studentId: string, requestId: string) {
  return serializable(async tx => {
    const request = await lockRequest(tx, requestId);
    if (!request || request.state !== "OPEN") throw new TeacherCollectionPurchaseError("REQUEST_NOT_OPEN");
    const student = await tx.user.findFirst({ where: { id: studentId, role: "STUDENT", status: "ACTIVE" }, select: { id: true } });
    if (!student) throw new TeacherCollectionPurchaseError("STUDENT_NOT_ACTIVE");
    if (request.collection.stickers.length === 0) throw new TeacherCollectionPurchaseError("EMPTY_COLLECTION");

    const existing = await tx.teacherCollectionOffer.findUnique({
      where: { requestId_studentId: { requestId, studentId } },
      include: { copies: true },
    });
    if (existing?.state === "ACTIVE") return existing;
    if (existing && existing.state !== "WITHDRAWN") throw new TeacherCollectionPurchaseError("OFFER_ALREADY_RESOLVED");

    const available = await tx.$queryRaw<Array<{ id: string; stickerId: string }>>`
      SELECT c."id", c."stickerId"
      FROM "StickerCopy" c
      JOIN "Sticker" s ON s."id" = c."stickerId"
      WHERE c."ownerId" = ${studentId}::uuid
        AND c."state" = 'OWNED'
        AND s."collectionId" = ${request.collectionId}::uuid
        AND s."state" = 'PUBLISHED'
      ORDER BY c."stickerId", c."serial"
      FOR UPDATE OF c
    `;
    const onePerSticker = new Map<string, string>();
    for (const copy of available) if (!onePerSticker.has(copy.stickerId)) onePerSticker.set(copy.stickerId, copy.id);
    if (onePerSticker.size !== request.collection.stickers.length) throw new TeacherCollectionPurchaseError("COLLECTION_INCOMPLETE");
    const copyIds = [...onePerSticker.values()];
    const changed = await tx.stickerCopy.updateMany({
      where: { id: { in: copyIds }, ownerId: studentId, state: "OWNED" },
      data: { state: "ESCROW" },
    });
    if (changed.count !== copyIds.length) throw new TeacherCollectionPurchaseError("COLLECTION_CHANGED");

    const offer = existing
      ? await tx.teacherCollectionOffer.update({ where: { id: existing.id }, data: { state: "ACTIVE", resolvedAt: null } })
      : await tx.teacherCollectionOffer.create({ data: { requestId, studentId } });
    if (existing) await tx.teacherCollectionOfferCopy.deleteMany({ where: { offerId: offer.id } });
    await tx.teacherCollectionOfferCopy.createMany({ data: copyIds.map(copyId => ({ offerId: offer.id, copyId })) });
    await tx.auditLog.create({
      data: { actorId: studentId, targetId: request.teacherId, event: "STICKER_COLLECTION_OFFERED", details: { requestId, offerId: offer.id, collectionId: request.collectionId, copyCount: copyIds.length } },
    });
    return offer;
  });
}

export async function withdrawCompleteCollectionOffer(studentId: string, requestId: string) {
  return serializable(async tx => {
    const request = await lockRequest(tx, requestId);
    if (!request || request.state !== "OPEN") throw new TeacherCollectionPurchaseError("REQUEST_NOT_OPEN");
    const offer = await tx.teacherCollectionOffer.findUnique({
      where: { requestId_studentId: { requestId, studentId } },
      include: { copies: { select: { copyId: true } } },
    });
    if (!offer || offer.state !== "ACTIVE") throw new TeacherCollectionPurchaseError("OFFER_NOT_ACTIVE");
    const copyIds = offer.copies.map(item => item.copyId);
    const released = await tx.stickerCopy.updateMany({ where: { id: { in: copyIds }, ownerId: studentId, state: "ESCROW" }, data: { state: "OWNED" } });
    if (released.count !== copyIds.length) throw new TeacherCollectionPurchaseError("COLLECTION_CHANGED");
    await tx.teacherCollectionOffer.update({ where: { id: offer.id }, data: { state: "WITHDRAWN", resolvedAt: new Date() } });
    await tx.auditLog.create({
      data: { actorId: studentId, targetId: request.teacherId, event: "STICKER_COLLECTION_OFFER_WITHDRAWN", details: { requestId, offerId: offer.id, copyCount: copyIds.length } },
    });
    return { withdrawn: true };
  });
}

export async function drawTeacherCollectionPurchase(teacherId: string, requestId: string) {
  return serializable(async tx => {
    const request = await lockRequest(tx, requestId);
    if (!request || request.teacherId !== teacherId) throw new TeacherCollectionPurchaseError("REQUEST_NOT_FOUND");
    if (request.state !== "OPEN") throw new TeacherCollectionPurchaseError("REQUEST_NOT_OPEN");
    const expectedCopies = request.collection.stickers.length;
    const offers = await tx.teacherCollectionOffer.findMany({
      where: { requestId, state: "ACTIVE" },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, status: true } },
        copies: { include: { copy: { select: { id: true, ownerId: true, state: true, sticker: { select: { collectionId: true, state: true } } } } } },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    const valid = offers.filter(offer => offer.student.status === "ACTIVE"
      && offer.copies.length === expectedCopies
      && offer.copies.every(item => item.copy.ownerId === offer.studentId
        && item.copy.state === "ESCROW"
        && item.copy.sticker.collectionId === request.collectionId
        && item.copy.sticker.state === "PUBLISHED"));
    if (valid.length === 0) throw new TeacherCollectionPurchaseError("NO_ELIGIBLE_OFFERS");
    const winner = valid[randomInt(valid.length)];
    const winnerCopyIds = winner.copies.map(item => item.copyId);
    const loserOffers = offers.filter(offer => offer.id !== winner.id);
    const loserCopyIds = loserOffers.flatMap(offer => offer.copies.map(item => item.copyId));

    const transferred = await tx.stickerCopy.updateMany({
      where: { id: { in: winnerCopyIds }, ownerId: winner.studentId, state: "ESCROW" },
      data: { ownerId: teacherId, state: "OWNED", acquiredAt: new Date() },
    });
    if (transferred.count !== expectedCopies) throw new TeacherCollectionPurchaseError("COLLECTION_CHANGED");
    if (loserCopyIds.length) await tx.stickerCopy.updateMany({ where: { id: { in: loserCopyIds }, state: "ESCROW" }, data: { state: "OWNED" } });
    await tx.teacherCollectionOffer.update({ where: { id: winner.id }, data: { state: "SELECTED", resolvedAt: new Date() } });
    await tx.teacherCollectionOffer.updateMany({ where: { requestId, id: { not: winner.id }, state: "ACTIVE" }, data: { state: "NOT_SELECTED", resolvedAt: new Date() } });

    await tx.user.update({ where: { id: winner.studentId }, data: { xp: { increment: request.xpAmount } } });
    const xpEntry = await tx.xpEntry.create({
      data: {
        studentId: winner.studentId,
        authorId: teacherId,
        delta: request.xpAmount,
        reason: `Venda da coleção completa ${request.collection.name} ao professor`,
        source: "STICKER_COLLECTION_SALE",
        idempotencyKey: `teacher-collection-purchase:${request.id}`,
      },
    });
    const purchase = await tx.teacherCollectionPurchase.create({
      data: { requestId, offerId: winner.id, teacherId, studentId: winner.studentId, xpAmount: request.xpAmount, xpEntryId: xpEntry.id },
    });
    await tx.teacherCollectionPurchaseRequest.update({ where: { id: requestId }, data: { state: "COMPLETED", resolvedAt: new Date() } });
    if (request.notificationId) {
      await tx.notification.update({
        where: { id: request.notificationId },
        data: { body: `A compra da coleção ${request.collection.name} foi concluída. A roleta selecionou uma oferta válida e o pagamento de ${request.xpAmount} XP foi registrado.` },
      });
    }
    await recalculatePatent(tx, winner.studentId);
    await tx.auditLog.create({
      data: {
        actorId: teacherId,
        targetId: winner.studentId,
        event: "STICKER_COLLECTION_PURCHASED",
        details: { requestId, purchaseId: purchase.id, offerId: winner.id, collectionId: request.collectionId, xpAmount: request.xpAmount, copyIds: winnerCopyIds, eligibleOffers: valid.length },
      },
    });
    return {
      purchaseId: purchase.id,
      winner: { id: winner.student.id, name: `${winner.student.firstName} ${winner.student.lastName}` },
      collection: request.collection.name,
      xpAmount: request.xpAmount,
      eligibleOffers: valid.length,
    };
  });
}
