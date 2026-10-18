CREATE TYPE "TicTacToeSoloStatus" AS ENUM ('ACTIVE', 'FINISHED');
CREATE TYPE "TicTacToeSoloResult" AS ENUM ('HUMAN_WIN', 'MACHINE_WIN', 'DRAW');

CREATE TABLE "TicTacToeSoloGame" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "creationKey" TEXT NOT NULL,
    "board" VARCHAR(9) NOT NULL DEFAULT '---------',
    "status" "TicTacToeSoloStatus" NOT NULL DEFAULT 'ACTIVE',
    "result" "TicTacToeSoloResult",
    "xpReward" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TicTacToeSoloGame_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TicTacToeSoloGame_board_check" CHECK ("board" ~ '^[XO-]{9}$'),
    CONSTRAINT "TicTacToeSoloGame_xpReward_check" CHECK ("xpReward" >= 0 AND "xpReward" <= 25)
);

CREATE TABLE "TicTacToeSoloAction" (
    "id" UUID NOT NULL,
    "gameId" UUID NOT NULL,
    "actionKey" TEXT NOT NULL,
    "humanCell" INTEGER NOT NULL,
    "machineCell" INTEGER,
    "board" VARCHAR(9) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TicTacToeSoloAction_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TicTacToeSoloAction_humanCell_check" CHECK ("humanCell" BETWEEN 0 AND 8),
    CONSTRAINT "TicTacToeSoloAction_machineCell_check" CHECK ("machineCell" IS NULL OR "machineCell" BETWEEN 0 AND 8),
    CONSTRAINT "TicTacToeSoloAction_board_check" CHECK ("board" ~ '^[XO-]{9}$')
);

CREATE UNIQUE INDEX "TicTacToeSoloGame_creationKey_key" ON "TicTacToeSoloGame"("creationKey");
CREATE INDEX "TicTacToeSoloGame_studentId_status_startedAt_idx" ON "TicTacToeSoloGame"("studentId", "status", "startedAt");
CREATE UNIQUE INDEX "TicTacToeSoloAction_actionKey_key" ON "TicTacToeSoloAction"("actionKey");
CREATE INDEX "TicTacToeSoloAction_gameId_createdAt_idx" ON "TicTacToeSoloAction"("gameId", "createdAt");

ALTER TABLE "TicTacToeSoloGame" ADD CONSTRAINT "TicTacToeSoloGame_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TicTacToeSoloAction" ADD CONSTRAINT "TicTacToeSoloAction_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "TicTacToeSoloGame"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
