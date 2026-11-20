CREATE TYPE "BrexRole" AS ENUM ('STUDENT', 'ASSISTANT');

CREATE TABLE "BrexSetting" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "version" TEXT NOT NULL DEFAULT '0.1.0',
  "origin" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BrexSetting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BrexChat" (
  "id" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BrexChat_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BrexMessage" (
  "id" UUID NOT NULL,
  "chatId" UUID NOT NULL,
  "role" "BrexRole" NOT NULL,
  "encrypted" TEXT NOT NULL,
  "inputTokens" INTEGER NOT NULL DEFAULT 0,
  "outputTokens" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BrexMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BrexRun" (
  "id" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "chatId" UUID,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BrexRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BrexChat_studentId_updatedAt_idx" ON "BrexChat"("studentId", "updatedAt");
CREATE INDEX "BrexMessage_chatId_createdAt_idx" ON "BrexMessage"("chatId", "createdAt");
CREATE INDEX "BrexRun_expiresAt_idx" ON "BrexRun"("expiresAt");
CREATE INDEX "BrexRun_studentId_chatId_idx" ON "BrexRun"("studentId", "chatId");
ALTER TABLE "BrexChat" ADD CONSTRAINT "BrexChat_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrexMessage" ADD CONSTRAINT "BrexMessage_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "BrexChat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrexRun" ADD CONSTRAINT "BrexRun_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
