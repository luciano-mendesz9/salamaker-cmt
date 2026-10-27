ALTER TYPE "DevCoinSource" ADD VALUE IF NOT EXISTS 'STUDENT_THEME';

CREATE TABLE "StudentThemePurchase" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "themeKey" TEXT NOT NULL,
    "amountPaid" INTEGER NOT NULL,
    "devCoinEntryId" UUID NOT NULL,
    "selectedAt" TIMESTAMP(3),
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentThemePurchase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudentThemePurchase_devCoinEntryId_key" ON "StudentThemePurchase"("devCoinEntryId");
CREATE UNIQUE INDEX "StudentThemePurchase_studentId_themeKey_key" ON "StudentThemePurchase"("studentId", "themeKey");
CREATE INDEX "StudentThemePurchase_studentId_selectedAt_idx" ON "StudentThemePurchase"("studentId", "selectedAt");
CREATE UNIQUE INDEX "StudentThemePurchase_one_selected_per_student_key"
ON "StudentThemePurchase"("studentId") WHERE "selectedAt" IS NOT NULL;

ALTER TABLE "StudentThemePurchase"
ADD CONSTRAINT "StudentThemePurchase_amountPaid_check" CHECK ("amountPaid" >= 0);

ALTER TABLE "StudentThemePurchase"
ADD CONSTRAINT "StudentThemePurchase_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StudentThemePurchase"
ADD CONSTRAINT "StudentThemePurchase_devCoinEntryId_fkey"
FOREIGN KEY ("devCoinEntryId") REFERENCES "DevCoinEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
