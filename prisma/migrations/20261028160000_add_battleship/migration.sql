ALTER TYPE "XpSource" ADD VALUE 'BATTLESHIP';

ALTER TYPE "AuditEvent" ADD VALUE 'BATTLESHIP_ROOM_CREATED';
ALTER TYPE "AuditEvent" ADD VALUE 'BATTLESHIP_MATCH_STARTED';
ALTER TYPE "AuditEvent" ADD VALUE 'BATTLESHIP_SHOT_FIRED';
ALTER TYPE "AuditEvent" ADD VALUE 'BATTLESHIP_MATCH_FINISHED';
ALTER TYPE "AuditEvent" ADD VALUE 'BATTLESHIP_ROOM_CANCELLED';

ALTER TYPE "DevCoinSource" ADD VALUE 'BATTLESHIP_WAGER';
ALTER TYPE "DevCoinSource" ADD VALUE 'BATTLESHIP_PRIZE';

ALTER TYPE "TreasuryEntrySource" ADD VALUE 'BATTLESHIP_MATCH_TAX';

CREATE TYPE "BattleshipRoomStatus" AS ENUM ('WAITING', 'ACTIVE', 'FINISHED', 'CANCELLED');

CREATE TABLE "BattleshipRoom" (
    "id" UUID NOT NULL,
    "code" VARCHAR(6) NOT NULL,
    "creationKey" TEXT NOT NULL,
    "ownerId" UUID NOT NULL,
    "guestId" UUID,
    "status" "BattleshipRoomStatus" NOT NULL DEFAULT 'WAITING',
    "wager" INTEGER NOT NULL,
    "escrowBalance" INTEGER NOT NULL DEFAULT 0,
    "currentTurnId" UUID,
    "winnerId" UUID,
    "loserId" UUID,
    "winnerPayout" INTEGER NOT NULL DEFAULT 0,
    "taxAmount" INTEGER NOT NULL DEFAULT 0,
    "shotSequence" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BattleshipRoom_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BattleshipBoard" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "ships" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BattleshipBoard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BattleshipShot" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "attackerId" UUID NOT NULL,
    "defenderId" UUID NOT NULL,
    "actionKey" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "cell" INTEGER NOT NULL,
    "hit" BOOLEAN NOT NULL,
    "sunkShip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BattleshipShot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BattleshipRoom_code_key" ON "BattleshipRoom"("code");
CREATE UNIQUE INDEX "BattleshipRoom_creationKey_key" ON "BattleshipRoom"("creationKey");
CREATE INDEX "BattleshipRoom_ownerId_status_startedAt_idx" ON "BattleshipRoom"("ownerId", "status", "startedAt");
CREATE INDEX "BattleshipRoom_guestId_status_startedAt_idx" ON "BattleshipRoom"("guestId", "status", "startedAt");
CREATE INDEX "BattleshipRoom_status_updatedAt_idx" ON "BattleshipRoom"("status", "updatedAt");
CREATE UNIQUE INDEX "BattleshipBoard_roomId_studentId_key" ON "BattleshipBoard"("roomId", "studentId");
CREATE INDEX "BattleshipBoard_studentId_createdAt_idx" ON "BattleshipBoard"("studentId", "createdAt");
CREATE UNIQUE INDEX "BattleshipShot_actionKey_key" ON "BattleshipShot"("actionKey");
CREATE UNIQUE INDEX "BattleshipShot_roomId_sequence_key" ON "BattleshipShot"("roomId", "sequence");
CREATE UNIQUE INDEX "BattleshipShot_roomId_attackerId_cell_key" ON "BattleshipShot"("roomId", "attackerId", "cell");
CREATE INDEX "BattleshipShot_roomId_createdAt_idx" ON "BattleshipShot"("roomId", "createdAt");
CREATE INDEX "BattleshipShot_defenderId_createdAt_idx" ON "BattleshipShot"("defenderId", "createdAt");

ALTER TABLE "BattleshipRoom" ADD CONSTRAINT "BattleshipRoom_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BattleshipRoom" ADD CONSTRAINT "BattleshipRoom_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BattleshipRoom" ADD CONSTRAINT "BattleshipRoom_currentTurnId_fkey" FOREIGN KEY ("currentTurnId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BattleshipRoom" ADD CONSTRAINT "BattleshipRoom_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BattleshipRoom" ADD CONSTRAINT "BattleshipRoom_loserId_fkey" FOREIGN KEY ("loserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BattleshipBoard" ADD CONSTRAINT "BattleshipBoard_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "BattleshipRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BattleshipBoard" ADD CONSTRAINT "BattleshipBoard_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BattleshipShot" ADD CONSTRAINT "BattleshipShot_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "BattleshipRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BattleshipShot" ADD CONSTRAINT "BattleshipShot_attackerId_fkey" FOREIGN KEY ("attackerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BattleshipShot" ADD CONSTRAINT "BattleshipShot_defenderId_fkey" FOREIGN KEY ("defenderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BattleshipRoom" ADD CONSTRAINT "BattleshipRoom_wager_check" CHECK ("wager" BETWEEN 10 AND 500 AND MOD("wager", 5) = 0);
ALTER TABLE "BattleshipBoard" ADD CONSTRAINT "BattleshipBoard_ships_check" CHECK (jsonb_typeof("ships") = 'array');
ALTER TABLE "BattleshipShot" ADD CONSTRAINT "BattleshipShot_cell_check" CHECK ("cell" BETWEEN 0 AND 99);
ALTER TABLE "BattleshipShot" ADD CONSTRAINT "BattleshipShot_distinct_players_check" CHECK ("attackerId" <> "defenderId");
