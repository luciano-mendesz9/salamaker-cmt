ALTER TYPE "XpSource" ADD VALUE 'ACTIVITY';
ALTER TYPE "AuditEvent" ADD VALUE 'ACTIVITY_CREATED';
ALTER TYPE "AuditEvent" ADD VALUE 'ACTIVITY_STATE_CHANGED';
ALTER TYPE "AuditEvent" ADD VALUE 'ACTIVITY_GRADED';

CREATE TYPE "ActivityType" AS ENUM ('EXTERNAL_LINK', 'FORM', 'GROUP');
CREATE TYPE "ActivityQuestionType" AS ENUM ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'WRITTEN');
CREATE TYPE "SubmissionStatus" AS ENUM ('SUBMITTED', 'AWAITING_REVIEW', 'GRADED');
CREATE TYPE "WrittenGrade" AS ENUM ('CORRECT', 'INCORRECT', 'PARTIAL');
CREATE TYPE "TeamDivisionMode" AS ENUM ('RANDOM', 'MANUAL');

ALTER TABLE "AppSetting" ADD COLUMN "timeZone" TEXT NOT NULL DEFAULT 'America/Fortaleza';

CREATE TABLE "Activity" (
  "id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "schoolClass" "SchoolClass" NOT NULL,
  "type" "ActivityType" NOT NULL,
  "opensAt" TIMESTAMP(3) NOT NULL,
  "closesAt" TIMESTAMP(3) NOT NULL,
  "manuallyClosedAt" TIMESTAMP(3),
  "externalUrl" TEXT,
  "maxXp" INTEGER NOT NULL,
  "authorId" UUID NOT NULL,
  "divisionMode" "TeamDivisionMode",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Activity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Activity_maxXp_check" CHECK ("maxXp" >= 0),
  CONSTRAINT "Activity_dates_check" CHECK ("closesAt" > "opensAt")
);

CREATE TABLE "ActivityRecipient" (
  "id" UUID NOT NULL,
  "activityId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "studentSignaledAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActivityRecipient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActivityQuestion" (
  "id" UUID NOT NULL,
  "activityId" UUID NOT NULL,
  "prompt" TEXT NOT NULL,
  "type" "ActivityQuestionType" NOT NULL,
  "maxXp" INTEGER NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "ActivityQuestion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ActivityQuestion_maxXp_check" CHECK ("maxXp" >= 0)
);

CREATE TABLE "ActivityOption" (
  "id" UUID NOT NULL,
  "questionId" UUID NOT NULL,
  "text" TEXT NOT NULL,
  "isCorrect" BOOLEAN NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "ActivityOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActivitySubmission" (
  "id" UUID NOT NULL,
  "activityId" UUID NOT NULL,
  "recipientId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "status" "SubmissionStatus" NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "gradedAt" TIMESTAMP(3),
  CONSTRAINT "ActivitySubmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActivityAnswer" (
  "id" UUID NOT NULL,
  "submissionId" UUID NOT NULL,
  "questionId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "writtenText" TEXT,
  "autoCorrect" BOOLEAN,
  "writtenGrade" "WrittenGrade",
  "awardedXp" INTEGER,
  "comment" TEXT,
  CONSTRAINT "ActivityAnswer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ActivityAnswer_awardedXp_check" CHECK ("awardedXp" IS NULL OR "awardedXp" >= 0)
);

CREATE TABLE "ActivityAnswerOption" (
  "answerId" UUID NOT NULL,
  "optionId" UUID NOT NULL,
  CONSTRAINT "ActivityAnswerOption_pkey" PRIMARY KEY ("answerId", "optionId")
);

CREATE TABLE "ActivityTeam" (
  "id" UUID NOT NULL,
  "activityId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "ActivityTeam_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActivityTeamMember" (
  "id" UUID NOT NULL,
  "teamId" UUID NOT NULL,
  "recipientId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  CONSTRAINT "ActivityTeamMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActivityAward" (
  "id" UUID NOT NULL,
  "activityId" UUID NOT NULL,
  "recipientId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "awardedXp" INTEGER NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "observation" TEXT,
  "latestXpEntryId" UUID NOT NULL,
  "gradedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ActivityAward_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ActivityAward_awardedXp_check" CHECK ("awardedXp" >= 0)
);

CREATE INDEX "Activity_schoolClass_opensAt_closesAt_idx" ON "Activity"("schoolClass", "opensAt", "closesAt");
CREATE INDEX "Activity_authorId_createdAt_idx" ON "Activity"("authorId", "createdAt");
CREATE UNIQUE INDEX "ActivityRecipient_activityId_studentId_key" ON "ActivityRecipient"("activityId", "studentId");
CREATE INDEX "ActivityRecipient_studentId_createdAt_idx" ON "ActivityRecipient"("studentId", "createdAt");
CREATE UNIQUE INDEX "ActivityQuestion_activityId_position_key" ON "ActivityQuestion"("activityId", "position");
CREATE UNIQUE INDEX "ActivityOption_questionId_position_key" ON "ActivityOption"("questionId", "position");
CREATE UNIQUE INDEX "ActivitySubmission_recipientId_key" ON "ActivitySubmission"("recipientId");
CREATE UNIQUE INDEX "ActivitySubmission_activityId_studentId_key" ON "ActivitySubmission"("activityId", "studentId");
CREATE INDEX "ActivitySubmission_activityId_status_idx" ON "ActivitySubmission"("activityId", "status");
CREATE UNIQUE INDEX "ActivityAnswer_submissionId_questionId_key" ON "ActivityAnswer"("submissionId", "questionId");
CREATE UNIQUE INDEX "ActivityTeam_activityId_position_key" ON "ActivityTeam"("activityId", "position");
CREATE UNIQUE INDEX "ActivityTeamMember_recipientId_key" ON "ActivityTeamMember"("recipientId");
CREATE UNIQUE INDEX "ActivityTeamMember_teamId_studentId_key" ON "ActivityTeamMember"("teamId", "studentId");
CREATE UNIQUE INDEX "ActivityAward_recipientId_key" ON "ActivityAward"("recipientId");
CREATE UNIQUE INDEX "ActivityAward_activityId_studentId_key" ON "ActivityAward"("activityId", "studentId");
CREATE INDEX "ActivityAward_studentId_gradedAt_idx" ON "ActivityAward"("studentId", "gradedAt");

ALTER TABLE "Activity" ADD CONSTRAINT "Activity_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActivityRecipient" ADD CONSTRAINT "ActivityRecipient_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityRecipient" ADD CONSTRAINT "ActivityRecipient_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActivityQuestion" ADD CONSTRAINT "ActivityQuestion_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityOption" ADD CONSTRAINT "ActivityOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ActivityQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivitySubmission" ADD CONSTRAINT "ActivitySubmission_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActivitySubmission" ADD CONSTRAINT "ActivitySubmission_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "ActivityRecipient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActivitySubmission" ADD CONSTRAINT "ActivitySubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActivityAnswer" ADD CONSTRAINT "ActivityAnswer_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "ActivitySubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityAnswer" ADD CONSTRAINT "ActivityAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ActivityQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActivityAnswer" ADD CONSTRAINT "ActivityAnswer_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActivityAnswerOption" ADD CONSTRAINT "ActivityAnswerOption_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "ActivityAnswer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityAnswerOption" ADD CONSTRAINT "ActivityAnswerOption_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "ActivityOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActivityTeam" ADD CONSTRAINT "ActivityTeam_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityTeamMember" ADD CONSTRAINT "ActivityTeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "ActivityTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityTeamMember" ADD CONSTRAINT "ActivityTeamMember_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "ActivityRecipient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActivityTeamMember" ADD CONSTRAINT "ActivityTeamMember_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActivityAward" ADD CONSTRAINT "ActivityAward_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActivityAward" ADD CONSTRAINT "ActivityAward_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "ActivityRecipient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActivityAward" ADD CONSTRAINT "ActivityAward_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActivityAward" ADD CONSTRAINT "ActivityAward_latestXpEntryId_fkey" FOREIGN KEY ("latestXpEntryId") REFERENCES "XpEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
