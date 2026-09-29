ALTER TYPE "XpSource" ADD VALUE 'DEV_COIN_TRANSFER';
ALTER TYPE "AuditEvent" ADD VALUE 'DEV_COIN_TRANSFERRED';
ALTER TYPE "DevCoinSource" ADD VALUE 'TRANSFER_SENT';
ALTER TYPE "DevCoinSource" ADD VALUE 'TRANSFER_RECEIVED';

CREATE TABLE "DevCoinTransfer" (
  "id" UUID NOT NULL,
  "senderId" UUID NOT NULL,
  "recipientId" UUID NOT NULL,
  "senderEntryId" UUID NOT NULL,
  "recipientEntryId" UUID NOT NULL,
  "xpEntryId" UUID NOT NULL,
  "amount" INTEGER NOT NULL,
  "xpFee" INTEGER NOT NULL DEFAULT 5,
  "weekKey" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DevCoinTransfer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DevCoinTransfer_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "DevCoinTransfer_xpFee_check" CHECK ("xpFee" = 5),
  CONSTRAINT "DevCoinTransfer_distinct_users_check" CHECK ("senderId" <> "recipientId")
);

CREATE UNIQUE INDEX "DevCoinTransfer_senderEntryId_key" ON "DevCoinTransfer"("senderEntryId");
CREATE UNIQUE INDEX "DevCoinTransfer_recipientEntryId_key" ON "DevCoinTransfer"("recipientEntryId");
CREATE UNIQUE INDEX "DevCoinTransfer_xpEntryId_key" ON "DevCoinTransfer"("xpEntryId");
CREATE UNIQUE INDEX "DevCoinTransfer_idempotencyKey_key" ON "DevCoinTransfer"("idempotencyKey");
CREATE INDEX "DevCoinTransfer_senderId_weekKey_createdAt_idx" ON "DevCoinTransfer"("senderId", "weekKey", "createdAt");
CREATE INDEX "DevCoinTransfer_recipientId_createdAt_idx" ON "DevCoinTransfer"("recipientId", "createdAt");

ALTER TABLE "DevCoinTransfer" ADD CONSTRAINT "DevCoinTransfer_senderId_fkey"
FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DevCoinTransfer" ADD CONSTRAINT "DevCoinTransfer_recipientId_fkey"
FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DevCoinTransfer" ADD CONSTRAINT "DevCoinTransfer_senderEntryId_fkey"
FOREIGN KEY ("senderEntryId") REFERENCES "DevCoinEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DevCoinTransfer" ADD CONSTRAINT "DevCoinTransfer_recipientEntryId_fkey"
FOREIGN KEY ("recipientEntryId") REFERENCES "DevCoinEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DevCoinTransfer" ADD CONSTRAINT "DevCoinTransfer_xpEntryId_fkey"
FOREIGN KEY ("xpEntryId") REFERENCES "XpEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
