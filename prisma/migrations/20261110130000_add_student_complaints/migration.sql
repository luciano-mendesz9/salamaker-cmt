ALTER TYPE "AuditEvent" ADD VALUE 'STUDENT_COMPLAINT_CREATED';
ALTER TYPE "AuditEvent" ADD VALUE 'STUDENT_COMPLAINT_REVOKED';
ALTER TYPE "DevCoinSource" ADD VALUE 'STUDENT_COMPLAINT_FEE';
ALTER TYPE "TreasuryEntrySource" ADD VALUE 'STUDENT_COMPLAINT_FEE';

CREATE TYPE "StudentComplaintStatus" AS ENUM ('ACTIVE', 'REVOKED');

CREATE TABLE "ComplaintCycle" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "periodKey" TEXT NOT NULL,
  "resetAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ComplaintCycle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StudentComplaint" (
  "id" UUID NOT NULL,
  "lessonId" UUID NOT NULL,
  "reporterId" UUID NOT NULL,
  "targetId" UUID NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "StudentComplaintStatus" NOT NULL DEFAULT 'ACTIVE',
  "requestKey" TEXT NOT NULL,
  "feeEntryId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "revokedById" UUID,
  "revocationReason" VARCHAR(500),
  CONSTRAINT "StudentComplaint_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudentComplaint_requestKey_key" ON "StudentComplaint"("requestKey");
CREATE UNIQUE INDEX "StudentComplaint_feeEntryId_key" ON "StudentComplaint"("feeEntryId");
CREATE UNIQUE INDEX "StudentComplaint_lessonId_reporterId_targetId_key" ON "StudentComplaint"("lessonId", "reporterId", "targetId");
CREATE INDEX "StudentComplaint_targetId_status_createdAt_idx" ON "StudentComplaint"("targetId", "status", "createdAt");
CREATE INDEX "StudentComplaint_lessonId_createdAt_idx" ON "StudentComplaint"("lessonId", "createdAt");
CREATE INDEX "StudentComplaint_reporterId_createdAt_idx" ON "StudentComplaint"("reporterId", "createdAt");

ALTER TABLE "StudentComplaint" ADD CONSTRAINT "StudentComplaint_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentComplaint" ADD CONSTRAINT "StudentComplaint_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentComplaint" ADD CONSTRAINT "StudentComplaint_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentComplaint" ADD CONSTRAINT "StudentComplaint_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentComplaint" ADD CONSTRAINT "StudentComplaint_feeEntryId_fkey" FOREIGN KEY ("feeEntryId") REFERENCES "DevCoinEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
