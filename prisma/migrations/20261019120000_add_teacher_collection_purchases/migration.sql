ALTER TYPE "XpSource" ADD VALUE 'STICKER_COLLECTION_SALE';

ALTER TYPE "AuditEvent" ADD VALUE 'STICKER_COLLECTION_REQUEST_CREATED';
ALTER TYPE "AuditEvent" ADD VALUE 'STICKER_COLLECTION_REQUEST_UPDATED';
ALTER TYPE "AuditEvent" ADD VALUE 'STICKER_COLLECTION_OFFERED';
ALTER TYPE "AuditEvent" ADD VALUE 'STICKER_COLLECTION_OFFER_WITHDRAWN';
ALTER TYPE "AuditEvent" ADD VALUE 'STICKER_COLLECTION_PURCHASED';
ALTER TYPE "AuditEvent" ADD VALUE 'STICKER_COLLECTION_REQUEST_CANCELLED';

CREATE TYPE "TeacherCollectionPurchaseRequestState" AS ENUM ('OPEN', 'COMPLETED', 'CANCELLED');
CREATE TYPE "TeacherCollectionOfferState" AS ENUM ('ACTIVE', 'SELECTED', 'NOT_SELECTED', 'WITHDRAWN');

CREATE TABLE "TeacherCollectionPurchaseRequest" (
  "id" UUID NOT NULL,
  "teacherId" UUID NOT NULL,
  "collectionId" UUID NOT NULL,
  "notificationId" UUID,
  "suggestedXp" INTEGER NOT NULL,
  "xpAmount" INTEGER NOT NULL,
  "state" "TeacherCollectionPurchaseRequestState" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "TeacherCollectionPurchaseRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TeacherCollectionPurchaseRequest_values_check" CHECK ("suggestedXp" > 0 AND "xpAmount" BETWEEN 1 AND 10000)
);

CREATE TABLE "TeacherCollectionOffer" (
  "id" UUID NOT NULL,
  "requestId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "state" "TeacherCollectionOfferState" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "TeacherCollectionOffer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeacherCollectionOfferCopy" (
  "offerId" UUID NOT NULL,
  "copyId" UUID NOT NULL,
  CONSTRAINT "TeacherCollectionOfferCopy_pkey" PRIMARY KEY ("offerId", "copyId")
);

CREATE TABLE "TeacherCollectionPurchase" (
  "id" UUID NOT NULL,
  "requestId" UUID NOT NULL,
  "offerId" UUID NOT NULL,
  "teacherId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "xpAmount" INTEGER NOT NULL,
  "xpEntryId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeacherCollectionPurchase_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TeacherCollectionPurchase_xpAmount_check" CHECK ("xpAmount" BETWEEN 1 AND 10000)
);

CREATE UNIQUE INDEX "TeacherCollectionPurchaseRequest_notificationId_key" ON "TeacherCollectionPurchaseRequest"("notificationId");
CREATE INDEX "TeacherCollectionPurchaseRequest_state_createdAt_idx" ON "TeacherCollectionPurchaseRequest"("state", "createdAt");
CREATE INDEX "TeacherCollectionPurchaseRequest_collectionId_state_idx" ON "TeacherCollectionPurchaseRequest"("collectionId", "state");
CREATE UNIQUE INDEX "TeacherCollectionPurchaseRequest_one_open_collection_idx" ON "TeacherCollectionPurchaseRequest"("collectionId") WHERE "state" = 'OPEN';

CREATE UNIQUE INDEX "TeacherCollectionOffer_requestId_studentId_key" ON "TeacherCollectionOffer"("requestId", "studentId");
CREATE INDEX "TeacherCollectionOffer_requestId_state_createdAt_idx" ON "TeacherCollectionOffer"("requestId", "state", "createdAt");
CREATE INDEX "TeacherCollectionOffer_studentId_state_idx" ON "TeacherCollectionOffer"("studentId", "state");

CREATE UNIQUE INDEX "TeacherCollectionPurchase_requestId_key" ON "TeacherCollectionPurchase"("requestId");
CREATE UNIQUE INDEX "TeacherCollectionPurchase_offerId_key" ON "TeacherCollectionPurchase"("offerId");
CREATE UNIQUE INDEX "TeacherCollectionPurchase_xpEntryId_key" ON "TeacherCollectionPurchase"("xpEntryId");
CREATE INDEX "TeacherCollectionPurchase_studentId_createdAt_idx" ON "TeacherCollectionPurchase"("studentId", "createdAt");
CREATE INDEX "TeacherCollectionPurchase_teacherId_createdAt_idx" ON "TeacherCollectionPurchase"("teacherId", "createdAt");

ALTER TABLE "TeacherCollectionPurchaseRequest" ADD CONSTRAINT "TeacherCollectionPurchaseRequest_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherCollectionPurchaseRequest" ADD CONSTRAINT "TeacherCollectionPurchaseRequest_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "StickerCollection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherCollectionPurchaseRequest" ADD CONSTRAINT "TeacherCollectionPurchaseRequest_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TeacherCollectionOffer" ADD CONSTRAINT "TeacherCollectionOffer_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "TeacherCollectionPurchaseRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherCollectionOffer" ADD CONSTRAINT "TeacherCollectionOffer_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TeacherCollectionOfferCopy" ADD CONSTRAINT "TeacherCollectionOfferCopy_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "TeacherCollectionOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherCollectionOfferCopy" ADD CONSTRAINT "TeacherCollectionOfferCopy_copyId_fkey" FOREIGN KEY ("copyId") REFERENCES "StickerCopy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TeacherCollectionPurchase" ADD CONSTRAINT "TeacherCollectionPurchase_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "TeacherCollectionPurchaseRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherCollectionPurchase" ADD CONSTRAINT "TeacherCollectionPurchase_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "TeacherCollectionOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherCollectionPurchase" ADD CONSTRAINT "TeacherCollectionPurchase_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherCollectionPurchase" ADD CONSTRAINT "TeacherCollectionPurchase_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherCollectionPurchase" ADD CONSTRAINT "TeacherCollectionPurchase_xpEntryId_fkey" FOREIGN KEY ("xpEntryId") REFERENCES "XpEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
