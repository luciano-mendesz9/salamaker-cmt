ALTER TYPE "XpSource" ADD VALUE 'EXTERNAL_CODE';

ALTER TYPE "AuditEvent" ADD VALUE 'XP_GRANT_CODE_CREATED';
ALTER TYPE "AuditEvent" ADD VALUE 'XP_GRANT_CODE_REDEEMED';

CREATE TABLE "XpGrantCode" (
    "id" UUID NOT NULL,
    "code" VARCHAR(6) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XpGrantCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "XpGrantRedemption" (
    "id" UUID NOT NULL,
    "grantCodeId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "xpEntryId" UUID NOT NULL,
    "xpAmount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XpGrantRedemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "XpGrantCode_code_key" ON "XpGrantCode"("code");
CREATE INDEX "XpGrantCode_createdById_createdAt_idx" ON "XpGrantCode"("createdById", "createdAt");
CREATE UNIQUE INDEX "XpGrantRedemption_xpEntryId_key" ON "XpGrantRedemption"("xpEntryId");
CREATE UNIQUE INDEX "XpGrantRedemption_grantCodeId_studentId_key" ON "XpGrantRedemption"("grantCodeId", "studentId");
CREATE INDEX "XpGrantRedemption_studentId_createdAt_idx" ON "XpGrantRedemption"("studentId", "createdAt");

ALTER TABLE "XpGrantCode" ADD CONSTRAINT "XpGrantCode_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "XpGrantRedemption" ADD CONSTRAINT "XpGrantRedemption_grantCodeId_fkey" FOREIGN KEY ("grantCodeId") REFERENCES "XpGrantCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "XpGrantRedemption" ADD CONSTRAINT "XpGrantRedemption_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "XpGrantRedemption" ADD CONSTRAINT "XpGrantRedemption_xpEntryId_fkey" FOREIGN KEY ("xpEntryId") REFERENCES "XpEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
