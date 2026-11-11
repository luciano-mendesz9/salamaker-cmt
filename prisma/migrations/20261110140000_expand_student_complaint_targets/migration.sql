CREATE TYPE "StudentComplaintKind" AS ENUM ('STUDENT', 'TEACHER');

ALTER TABLE "StudentComplaint"
  ADD COLUMN "targetKind" "StudentComplaintKind" NOT NULL DEFAULT 'STUDENT',
  ADD COLUMN "ordinal" INTEGER NOT NULL DEFAULT 1,
  ALTER COLUMN "feeEntryId" DROP NOT NULL;

DROP INDEX "StudentComplaint_lessonId_reporterId_targetId_key";
CREATE UNIQUE INDEX "StudentComplaint_lessonId_reporterId_targetId_ordinal_key"
  ON "StudentComplaint"("lessonId", "reporterId", "targetId", "ordinal");

ALTER TABLE "StudentComplaint" ADD CONSTRAINT "StudentComplaint_target_fee_check"
  CHECK (
    ("targetKind" = 'STUDENT' AND "ordinal" BETWEEN 1 AND 3 AND "feeEntryId" IS NOT NULL)
    OR ("targetKind" = 'TEACHER' AND "ordinal" = 1 AND "feeEntryId" IS NULL)
  );
