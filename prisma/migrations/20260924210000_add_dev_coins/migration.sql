ALTER TYPE "AuditEvent" ADD VALUE 'DEV_COIN_GRANTED';
ALTER TYPE "AuditEvent" ADD VALUE 'DEV_COIN_RATE_CHANGED';
ALTER TYPE "XpSource" ADD VALUE 'DEV_COIN_PURCHASE';

CREATE TYPE "DevCoinSource" AS ENUM ('PURCHASE', 'TEACHER_GRANT', 'INITIAL_GRANT', 'PROFILE_AVATAR');
CREATE TYPE "AvatarPurchaseCurrency" AS ENUM ('XP', 'DEV_COIN');

ALTER TABLE "User"
ADD COLUMN "devCoins" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "AppSetting"
ADD COLUMN "xpPerDevCoin" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "ProfileAvatarPurchase"
RENAME COLUMN "pricePaid" TO "amountPaid";

ALTER TABLE "ProfileAvatarPurchase"
ALTER COLUMN "xpEntryId" DROP NOT NULL,
ADD COLUMN "currency" "AvatarPurchaseCurrency" NOT NULL DEFAULT 'XP',
ADD COLUMN "devCoinEntryId" UUID;

CREATE TABLE "DevCoinEntry" (
  "id" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "authorId" UUID,
  "xpEntryId" UUID,
  "delta" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "source" "DevCoinSource" NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DevCoinEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DevCoinEntry_delta_check" CHECK ("delta" <> 0)
);

CREATE UNIQUE INDEX "DevCoinEntry_xpEntryId_key" ON "DevCoinEntry"("xpEntryId");
CREATE UNIQUE INDEX "DevCoinEntry_idempotencyKey_key" ON "DevCoinEntry"("idempotencyKey");
CREATE INDEX "DevCoinEntry_studentId_createdAt_idx" ON "DevCoinEntry"("studentId", "createdAt");
CREATE UNIQUE INDEX "ProfileAvatarPurchase_devCoinEntryId_key" ON "ProfileAvatarPurchase"("devCoinEntryId");

ALTER TABLE "DevCoinEntry"
ADD CONSTRAINT "DevCoinEntry_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DevCoinEntry"
ADD CONSTRAINT "DevCoinEntry_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DevCoinEntry"
ADD CONSTRAINT "DevCoinEntry_xpEntryId_fkey"
FOREIGN KEY ("xpEntryId") REFERENCES "XpEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProfileAvatarPurchase"
ADD CONSTRAINT "ProfileAvatarPurchase_devCoinEntryId_fkey"
FOREIGN KEY ("devCoinEntryId") REFERENCES "DevCoinEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "User"
ADD CONSTRAINT "User_devCoins_check" CHECK ("devCoins" >= 0);

ALTER TABLE "AppSetting"
ADD CONSTRAINT "AppSetting_xpPerDevCoin_check" CHECK ("xpPerDevCoin" >= 1);

ALTER TABLE "ProfileAvatarPurchase"
ADD CONSTRAINT "ProfileAvatarPurchase_amountPaid_check" CHECK ("amountPaid" >= 0),
ADD CONSTRAINT "ProfileAvatarPurchase_payment_entry_check" CHECK (
  ("currency" = 'XP' AND "xpEntryId" IS NOT NULL AND "devCoinEntryId" IS NULL)
  OR
  ("currency" = 'DEV_COIN' AND "xpEntryId" IS NULL AND "devCoinEntryId" IS NOT NULL)
);

INSERT INTO "DevCoinEntry" (
  "id", "studentId", "delta", "reason", "source", "idempotencyKey"
)
SELECT
  gen_random_uuid(),
  "id",
  25,
  'Bônus inicial de lançamento das Dev-Coins',
  'INITIAL_GRANT',
  'dev-coin-launch-grant:' || "id"::text
FROM "User"
WHERE "role" = 'STUDENT';

UPDATE "User"
SET "devCoins" = "devCoins" + 25
WHERE "role" = 'STUDENT';
