ALTER TYPE "XpSource" ADD VALUE 'PROFILE_AVATAR';

CREATE TABLE "ProfileAvatarPurchase" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "avatarKey" TEXT NOT NULL,
    "pricePaid" INTEGER NOT NULL,
    "xpEntryId" UUID NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileAvatarPurchase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProfileAvatarPurchase_xpEntryId_key" ON "ProfileAvatarPurchase"("xpEntryId");
CREATE UNIQUE INDEX "ProfileAvatarPurchase_studentId_avatarKey_key" ON "ProfileAvatarPurchase"("studentId", "avatarKey");
CREATE INDEX "ProfileAvatarPurchase_studentId_purchasedAt_idx" ON "ProfileAvatarPurchase"("studentId", "purchasedAt");

ALTER TABLE "ProfileAvatarPurchase"
ADD CONSTRAINT "ProfileAvatarPurchase_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProfileAvatarPurchase"
ADD CONSTRAINT "ProfileAvatarPurchase_xpEntryId_fkey"
FOREIGN KEY ("xpEntryId") REFERENCES "XpEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The paid-avatar launch starts every account from the free default image.
UPDATE "User" SET "profileAvatar" = 'default' WHERE "profileAvatar" <> 'default';
