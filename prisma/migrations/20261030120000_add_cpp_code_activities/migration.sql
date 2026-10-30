ALTER TYPE "ActivityType" ADD VALUE 'CPP_CODE';

ALTER TABLE "Activity" ADD COLUMN "codePrompt" TEXT,
ADD COLUMN "codeImageUrl" TEXT;

ALTER TABLE "ActivityRecipient" ADD COLUMN "codingStartedAt" TIMESTAMP(3);

ALTER TABLE "ActivitySubmission" ADD COLUMN "codingSeconds" INTEGER;

ALTER TABLE "ActivitySubmission" ADD CONSTRAINT "ActivitySubmission_codingSeconds_check" CHECK ("codingSeconds" IS NULL OR "codingSeconds" >= 0);
