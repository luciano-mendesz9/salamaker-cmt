CREATE TABLE "BrexTokenAccount" (
  "id" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "usedTokens" INTEGER NOT NULL DEFAULT 0,
  "exhaustedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BrexTokenAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BrexTokenAccount_studentId_key" ON "BrexTokenAccount"("studentId");
ALTER TABLE "BrexTokenAccount" ADD CONSTRAINT "BrexTokenAccount_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
