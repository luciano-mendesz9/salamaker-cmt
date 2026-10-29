ALTER TYPE "XpSource" ADD VALUE IF NOT EXISTS 'INVESTMENT_FEE';
ALTER TYPE "AuditEvent" ADD VALUE IF NOT EXISTS 'INVESTMENT_APPLIED';
ALTER TYPE "AuditEvent" ADD VALUE IF NOT EXISTS 'INVESTMENT_REDEEMED';
ALTER TYPE "AuditEvent" ADD VALUE IF NOT EXISTS 'INVESTMENT_RESERVE_CHANGED';
ALTER TYPE "DevCoinSource" ADD VALUE IF NOT EXISTS 'INVESTMENT_APPLICATION';
ALTER TYPE "DevCoinSource" ADD VALUE IF NOT EXISTS 'INVESTMENT_REDEMPTION';
ALTER TYPE "TreasuryEntrySource" ADD VALUE IF NOT EXISTS 'INVESTMENT_APPLICATION';
ALTER TYPE "TreasuryEntrySource" ADD VALUE IF NOT EXISTS 'INVESTMENT_REDEMPTION';

CREATE TYPE "InvestmentProduct" AS ENUM ('MAKER_SAVINGS', 'MAKER_BOND', 'MAKER_BOND_PLUS');
CREATE TYPE "InvestmentStatus" AS ENUM ('ACTIVE', 'REDEEMED');
CREATE TYPE "InvestmentTransactionType" AS ENUM ('APPLICATION', 'REDEMPTION');
CREATE TYPE "InvestmentReserveEntrySource" AS ENUM ('ADMIN_MINT', 'ADMIN_BURN', 'REDEMPTION_GUARANTEE');

CREATE TABLE "InvestmentFund" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "targetBalance" INTEGER NOT NULL DEFAULT 30000,
    "coverageBps" INTEGER NOT NULL DEFAULT 12000,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InvestmentFund_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "InvestmentFund_singleton_check" CHECK ("id" = 1),
    CONSTRAINT "InvestmentFund_balance_check" CHECK ("balance" >= 0),
    CONSTRAINT "InvestmentFund_target_check" CHECK ("targetBalance" >= 0),
    CONSTRAINT "InvestmentFund_coverage_check" CHECK ("coverageBps" >= 10000)
);

CREATE TABLE "InvestmentPosition" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "product" "InvestmentProduct" NOT NULL,
    "status" "InvestmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "principal" INTEGER NOT NULL,
    "weeklyRateBps" INTEGER NOT NULL,
    "xpBase" INTEGER NOT NULL,
    "xpFee" INTEGER NOT NULL,
    "applicationDay" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unlockAt" TIMESTAMP(3) NOT NULL,
    "yieldEndsAt" TIMESTAMP(3) NOT NULL,
    "redeemedAt" TIMESTAMP(3),
    "feeXpEntryId" UUID,
    CONSTRAINT "InvestmentPosition_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "InvestmentPosition_principal_check" CHECK ("principal" >= 1000 AND "principal" % 1000 = 0),
    CONSTRAINT "InvestmentPosition_rate_check" CHECK ("weeklyRateBps" > 0),
    CONSTRAINT "InvestmentPosition_xp_check" CHECK ("xpBase" >= 0 AND "xpFee" >= 0),
    CONSTRAINT "InvestmentPosition_dates_check" CHECK ("unlockAt" > "appliedAt" AND "yieldEndsAt" >= "unlockAt")
);

CREATE TABLE "InvestmentTransaction" (
    "id" UUID NOT NULL,
    "positionId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "type" "InvestmentTransactionType" NOT NULL,
    "principalAmount" INTEGER NOT NULL,
    "dividendAmount" INTEGER NOT NULL DEFAULT 0,
    "devCoinEntryId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvestmentTransaction_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "InvestmentTransaction_amounts_check" CHECK ("principalAmount" > 0 AND "dividendAmount" >= 0)
);

CREATE TABLE "InvestmentReserveEntry" (
    "id" UUID NOT NULL,
    "authorId" UUID,
    "transactionId" UUID,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "source" "InvestmentReserveEntrySource" NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvestmentReserveEntry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "InvestmentReserveEntry_delta_check" CHECK ("delta" <> 0)
);

CREATE UNIQUE INDEX "InvestmentPosition_feeXpEntryId_key" ON "InvestmentPosition"("feeXpEntryId");
CREATE INDEX "InvestmentPosition_studentId_status_appliedAt_idx" ON "InvestmentPosition"("studentId", "status", "appliedAt");
CREATE INDEX "InvestmentPosition_status_yieldEndsAt_idx" ON "InvestmentPosition"("status", "yieldEndsAt");
CREATE INDEX "InvestmentPosition_studentId_applicationDay_idx" ON "InvestmentPosition"("studentId", "applicationDay");
CREATE UNIQUE INDEX "InvestmentTransaction_devCoinEntryId_key" ON "InvestmentTransaction"("devCoinEntryId");
CREATE UNIQUE INDEX "InvestmentTransaction_requestId_key" ON "InvestmentTransaction"("requestId");
CREATE INDEX "InvestmentTransaction_studentId_createdAt_idx" ON "InvestmentTransaction"("studentId", "createdAt");
CREATE INDEX "InvestmentTransaction_positionId_createdAt_idx" ON "InvestmentTransaction"("positionId", "createdAt");
CREATE UNIQUE INDEX "InvestmentReserveEntry_transactionId_key" ON "InvestmentReserveEntry"("transactionId");
CREATE UNIQUE INDEX "InvestmentReserveEntry_idempotencyKey_key" ON "InvestmentReserveEntry"("idempotencyKey");
CREATE INDEX "InvestmentReserveEntry_createdAt_idx" ON "InvestmentReserveEntry"("createdAt");

ALTER TABLE "InvestmentPosition" ADD CONSTRAINT "InvestmentPosition_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvestmentPosition" ADD CONSTRAINT "InvestmentPosition_feeXpEntryId_fkey" FOREIGN KEY ("feeXpEntryId") REFERENCES "XpEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvestmentTransaction" ADD CONSTRAINT "InvestmentTransaction_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "InvestmentPosition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvestmentTransaction" ADD CONSTRAINT "InvestmentTransaction_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvestmentTransaction" ADD CONSTRAINT "InvestmentTransaction_devCoinEntryId_fkey" FOREIGN KEY ("devCoinEntryId") REFERENCES "DevCoinEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvestmentReserveEntry" ADD CONSTRAINT "InvestmentReserveEntry_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InvestmentReserveEntry" ADD CONSTRAINT "InvestmentReserveEntry_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "InvestmentTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "InvestmentFund" ("id", "balance", "targetBalance", "coverageBps", "updatedAt")
VALUES (1, 0, 30000, 12000, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
