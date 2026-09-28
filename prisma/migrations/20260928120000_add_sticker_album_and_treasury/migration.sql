ALTER TYPE "AuditEvent" ADD VALUE 'DEV_COIN_TREASURY_CHANGED';
ALTER TYPE "AuditEvent" ADD VALUE 'STICKER_ACTIVATED';
ALTER TYPE "AuditEvent" ADD VALUE 'STICKER_PACK_PURCHASED';
ALTER TYPE "AuditEvent" ADD VALUE 'STICKER_LISTED';
ALTER TYPE "AuditEvent" ADD VALUE 'STICKER_TRADED';
ALTER TYPE "AuditEvent" ADD VALUE 'STICKER_DONATED';

ALTER TYPE "DevCoinSource" ADD VALUE 'STICKER_PACK';
ALTER TYPE "DevCoinSource" ADD VALUE 'STICKER_MARKET';
ALTER TYPE "DevCoinSource" ADD VALUE 'PATENT_REWARD';

CREATE TYPE "StickerCollectionState" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "StickerState" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "StickerRarity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "StickerCopyState" AS ENUM ('TREASURY', 'OWNED', 'ESCROW');
CREATE TYPE "StickerListingState" AS ENUM ('ACTIVE', 'SOLD', 'CANCELLED', 'EXPIRED');
CREATE TYPE "StickerDonationState" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED');
CREATE TYPE "PatentRewardState" AS ENUM ('PAID', 'PENDING');
CREATE TYPE "TreasuryEntrySource" AS ENUM ('OPENING', 'EXISTING_CIRCULATION', 'XP_CONVERSION', 'PLATFORM_PURCHASE', 'MARKET_FEE', 'PATENT_REWARD', 'TEACHER_DISTRIBUTION', 'ADMIN_MINT', 'ADMIN_BURN');

DO $$
DECLARE
  mismatch_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO mismatch_count
  FROM (
    SELECT u."id"
    FROM "User" u
    LEFT JOIN "DevCoinEntry" d ON d."studentId" = u."id"
    WHERE u."role" = 'STUDENT'
    GROUP BY u."id", u."devCoins"
    HAVING COALESCE(SUM(d."delta"), 0) <> u."devCoins"
  ) mismatches;

  IF mismatch_count > 0 THEN
    RAISE EXCEPTION 'Dev-Coin migration blocked: % student balance(s) diverge from the ledger', mismatch_count;
  END IF;
END $$;

CREATE TABLE "StickerCollection" (
  "id" UUID NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "state" "StickerCollectionState" NOT NULL DEFAULT 'DRAFT',
  "activatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StickerCollection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Sticker" (
  "id" UUID NOT NULL,
  "collectionId" UUID NOT NULL,
  "number" INTEGER NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "alt" TEXT NOT NULL,
  "imagePath" TEXT NOT NULL,
  "manifestHash" TEXT NOT NULL,
  "totalCopies" INTEGER NOT NULL,
  "rarity" "StickerRarity" NOT NULL,
  "score" INTEGER NOT NULL,
  "state" "StickerState" NOT NULL DEFAULT 'DRAFT',
  "publishedAt" TIMESTAMP(3),
  "firstDistributedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Sticker_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Sticker_totalCopies_check" CHECK ("totalCopies" >= 30),
  CONSTRAINT "Sticker_number_check" CHECK ("number" > 0),
  CONSTRAINT "Sticker_score_check" CHECK ("score" > 0)
);

CREATE TABLE "StickerPackPurchase" (
  "id" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "price" INTEGER NOT NULL,
  "schoolDay" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StickerPackPurchase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StickerCopy" (
  "id" UUID NOT NULL,
  "stickerId" UUID NOT NULL,
  "serial" INTEGER NOT NULL,
  "ownerId" UUID,
  "state" "StickerCopyState" NOT NULL DEFAULT 'TREASURY',
  "packPurchaseId" UUID,
  "acquiredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StickerCopy_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StickerCopy_owner_state_check" CHECK (
    ("state" = 'TREASURY' AND "ownerId" IS NULL)
    OR ("state" IN ('OWNED', 'ESCROW') AND "ownerId" IS NOT NULL)
  )
);

CREATE TABLE "StickerListing" (
  "id" UUID NOT NULL,
  "copyId" UUID NOT NULL,
  "sellerId" UUID NOT NULL,
  "buyerId" UUID,
  "price" INTEGER NOT NULL,
  "state" "StickerListingState" NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "settledAt" TIMESTAMP(3),
  CONSTRAINT "StickerListing_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StickerListing_price_check" CHECK ("price" > 0)
);

CREATE TABLE "StickerTrade" (
  "id" UUID NOT NULL,
  "listingId" UUID NOT NULL,
  "sellerId" UUID NOT NULL,
  "buyerId" UUID NOT NULL,
  "price" INTEGER NOT NULL,
  "sellerAmount" INTEGER NOT NULL,
  "fee" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StickerTrade_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StickerTrade_split_check" CHECK ("price" > 0 AND "sellerAmount" >= 0 AND "fee" >= 0 AND "sellerAmount" + "fee" = "price")
);

CREATE TABLE "StickerDonation" (
  "id" UUID NOT NULL,
  "copyId" UUID NOT NULL,
  "senderId" UUID NOT NULL,
  "recipientId" UUID NOT NULL,
  "state" "StickerDonationState" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "StickerDonation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StickerDonation_distinct_parties_check" CHECK ("senderId" <> "recipientId")
);

CREATE TABLE "PatentLevel" (
  "id" UUID NOT NULL,
  "collectionId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "rank" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "threshold" INTEGER NOT NULL,
  "xpReward" INTEGER NOT NULL,
  "devCoinReward" INTEGER NOT NULL,
  "packReward" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "PatentLevel_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PatentLevel_values_check" CHECK ("version" > 0 AND "rank" > 0 AND "threshold" >= 0 AND "xpReward" >= 0 AND "devCoinReward" >= 0 AND "packReward" >= 0)
);

CREATE TABLE "StudentPatentProgress" (
  "id" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "score" INTEGER NOT NULL DEFAULT 0,
  "levelId" UUID,
  "bestRank" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentPatentProgress_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudentPatentProgress_values_check" CHECK ("score" >= 0 AND "bestRank" >= 1)
);

CREATE TABLE "PatentRewardClaim" (
  "id" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "patentLevelId" UUID NOT NULL,
  "state" "PatentRewardState" NOT NULL,
  "xpPaid" INTEGER NOT NULL DEFAULT 0,
  "devCoinsPaid" INTEGER NOT NULL DEFAULT 0,
  "packPaid" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paidAt" TIMESTAMP(3),
  CONSTRAINT "PatentRewardClaim_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PatentRewardClaim_values_check" CHECK ("xpPaid" >= 0 AND "devCoinsPaid" >= 0 AND "packPaid" >= 0)
);

CREATE TABLE "DevCoinTreasury" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "balance" INTEGER NOT NULL,
  "totalSupply" INTEGER NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DevCoinTreasury_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DevCoinTreasury_singleton_check" CHECK ("id" = 1),
  CONSTRAINT "DevCoinTreasury_values_check" CHECK ("balance" >= 0 AND "totalSupply" >= 0 AND "balance" <= "totalSupply")
);

CREATE TABLE "DevCoinTreasuryEntry" (
  "id" UUID NOT NULL,
  "authorId" UUID,
  "devCoinEntryId" UUID,
  "delta" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "source" "TreasuryEntrySource" NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DevCoinTreasuryEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DevCoinTreasuryEntry_delta_check" CHECK ("delta" <> 0)
);

CREATE UNIQUE INDEX "StickerCollection_slug_key" ON "StickerCollection"("slug");
CREATE UNIQUE INDEX "Sticker_slug_key" ON "Sticker"("slug");
CREATE UNIQUE INDEX "Sticker_collectionId_number_key" ON "Sticker"("collectionId", "number");
CREATE INDEX "Sticker_collectionId_state_number_idx" ON "Sticker"("collectionId", "state", "number");
CREATE UNIQUE INDEX "StickerCopy_stickerId_serial_key" ON "StickerCopy"("stickerId", "serial");
CREATE INDEX "StickerCopy_ownerId_state_stickerId_idx" ON "StickerCopy"("ownerId", "state", "stickerId");
CREATE INDEX "StickerCopy_state_stickerId_idx" ON "StickerCopy"("state", "stickerId");
CREATE UNIQUE INDEX "StickerPackPurchase_idempotencyKey_key" ON "StickerPackPurchase"("idempotencyKey");
CREATE INDEX "StickerPackPurchase_studentId_schoolDay_idx" ON "StickerPackPurchase"("studentId", "schoolDay");
CREATE INDEX "StickerListing_state_expiresAt_idx" ON "StickerListing"("state", "expiresAt");
CREATE INDEX "StickerListing_sellerId_state_idx" ON "StickerListing"("sellerId", "state");
CREATE UNIQUE INDEX "StickerListing_one_active_copy_idx" ON "StickerListing"("copyId") WHERE "state" = 'ACTIVE';
CREATE UNIQUE INDEX "StickerTrade_listingId_key" ON "StickerTrade"("listingId");
CREATE INDEX "StickerDonation_recipientId_state_expiresAt_idx" ON "StickerDonation"("recipientId", "state", "expiresAt");
CREATE INDEX "StickerDonation_senderId_state_idx" ON "StickerDonation"("senderId", "state");
CREATE UNIQUE INDEX "StickerDonation_one_pending_copy_idx" ON "StickerDonation"("copyId") WHERE "state" = 'PENDING';
CREATE UNIQUE INDEX "PatentLevel_collectionId_version_rank_key" ON "PatentLevel"("collectionId", "version", "rank");
CREATE UNIQUE INDEX "StudentPatentProgress_studentId_key" ON "StudentPatentProgress"("studentId");
CREATE UNIQUE INDEX "PatentRewardClaim_studentId_patentLevelId_key" ON "PatentRewardClaim"("studentId", "patentLevelId");
CREATE UNIQUE INDEX "DevCoinTreasuryEntry_devCoinEntryId_key" ON "DevCoinTreasuryEntry"("devCoinEntryId");
CREATE UNIQUE INDEX "DevCoinTreasuryEntry_idempotencyKey_key" ON "DevCoinTreasuryEntry"("idempotencyKey");
CREATE INDEX "DevCoinTreasuryEntry_createdAt_idx" ON "DevCoinTreasuryEntry"("createdAt");

ALTER TABLE "Sticker" ADD CONSTRAINT "Sticker_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "StickerCollection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StickerPackPurchase" ADD CONSTRAINT "StickerPackPurchase_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StickerCopy" ADD CONSTRAINT "StickerCopy_stickerId_fkey" FOREIGN KEY ("stickerId") REFERENCES "Sticker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StickerCopy" ADD CONSTRAINT "StickerCopy_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StickerCopy" ADD CONSTRAINT "StickerCopy_packPurchaseId_fkey" FOREIGN KEY ("packPurchaseId") REFERENCES "StickerPackPurchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StickerListing" ADD CONSTRAINT "StickerListing_copyId_fkey" FOREIGN KEY ("copyId") REFERENCES "StickerCopy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StickerListing" ADD CONSTRAINT "StickerListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StickerListing" ADD CONSTRAINT "StickerListing_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StickerTrade" ADD CONSTRAINT "StickerTrade_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "StickerListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StickerTrade" ADD CONSTRAINT "StickerTrade_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StickerTrade" ADD CONSTRAINT "StickerTrade_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StickerDonation" ADD CONSTRAINT "StickerDonation_copyId_fkey" FOREIGN KEY ("copyId") REFERENCES "StickerCopy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StickerDonation" ADD CONSTRAINT "StickerDonation_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StickerDonation" ADD CONSTRAINT "StickerDonation_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PatentLevel" ADD CONSTRAINT "PatentLevel_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "StickerCollection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentPatentProgress" ADD CONSTRAINT "StudentPatentProgress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentPatentProgress" ADD CONSTRAINT "StudentPatentProgress_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "PatentLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PatentRewardClaim" ADD CONSTRAINT "PatentRewardClaim_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PatentRewardClaim" ADD CONSTRAINT "PatentRewardClaim_patentLevelId_fkey" FOREIGN KEY ("patentLevelId") REFERENCES "PatentLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DevCoinTreasuryEntry" ADD CONSTRAINT "DevCoinTreasuryEntry_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DevCoinTreasuryEntry" ADD CONSTRAINT "DevCoinTreasuryEntry_devCoinEntryId_fkey" FOREIGN KEY ("devCoinEntryId") REFERENCES "DevCoinEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

WITH circulation AS (
  SELECT COALESCE(SUM("devCoins"), 0)::INTEGER AS amount
  FROM "User"
  WHERE "role" = 'STUDENT'
)
INSERT INTO "DevCoinTreasury" ("id", "balance", "totalSupply", "updatedAt")
SELECT 1, 1500, 1500 + amount, CURRENT_TIMESTAMP
FROM circulation;

WITH circulation AS (
  SELECT COALESCE(SUM("devCoins"), 0)::INTEGER AS amount
  FROM "User"
  WHERE "role" = 'STUDENT'
), opening AS (
  INSERT INTO "DevCoinTreasuryEntry" ("id", "delta", "reason", "source", "idempotencyKey")
  SELECT gen_random_uuid(), 1500 + amount,
    'Abertura: 1.000 DC solicitados + 500 DC de reserva + saldos existentes',
    'OPENING', 'treasury:opening'
  FROM circulation
)
INSERT INTO "DevCoinTreasuryEntry" ("id", "delta", "reason", "source", "idempotencyKey")
SELECT gen_random_uuid(), -amount,
  'Reconhecimento dos Dev-Coins que ja estavam em circulacao nos saldos dos alunos',
  'EXISTING_CIRCULATION', 'treasury:existing-circulation'
FROM circulation
WHERE amount > 0;

DO $$
DECLARE
  students_total INTEGER;
  treasury_balance INTEGER;
  managed_supply INTEGER;
  ledger_balance INTEGER;
BEGIN
  SELECT COALESCE(SUM("devCoins"), 0)::INTEGER INTO students_total FROM "User" WHERE "role" = 'STUDENT';
  SELECT "balance", "totalSupply" INTO treasury_balance, managed_supply FROM "DevCoinTreasury" WHERE "id" = 1;
  SELECT COALESCE(SUM("delta"), 0)::INTEGER INTO ledger_balance FROM "DevCoinTreasuryEntry";

  IF treasury_balance <> 1500 OR managed_supply <> treasury_balance + students_total OR ledger_balance <> treasury_balance THEN
    RAISE EXCEPTION 'Dev-Coin treasury invariant failed during migration';
  END IF;
END $$;
