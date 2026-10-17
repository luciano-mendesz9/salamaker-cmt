ALTER TYPE "XpSource" ADD VALUE 'TIC_TAC_TOE_RESULT';
ALTER TYPE "XpSource" ADD VALUE 'SUDOKU_RESULT';

ALTER TYPE "AuditEvent" ADD VALUE 'TIC_TAC_TOE_ROOM_CREATED';
ALTER TYPE "AuditEvent" ADD VALUE 'TIC_TAC_TOE_MATCH_STARTED';
ALTER TYPE "AuditEvent" ADD VALUE 'TIC_TAC_TOE_MOVE_PLAYED';
ALTER TYPE "AuditEvent" ADD VALUE 'TIC_TAC_TOE_MATCH_FINISHED';
ALTER TYPE "AuditEvent" ADD VALUE 'TIC_TAC_TOE_REMATCH_REQUESTED';
ALTER TYPE "AuditEvent" ADD VALUE 'TIC_TAC_TOE_ROOM_CANCELLED';
ALTER TYPE "AuditEvent" ADD VALUE 'SUDOKU_GAME_STARTED';
ALTER TYPE "AuditEvent" ADD VALUE 'SUDOKU_HINT_USED';
ALTER TYPE "AuditEvent" ADD VALUE 'SUDOKU_EXTRA_ERRORS_PURCHASED';
ALTER TYPE "AuditEvent" ADD VALUE 'SUDOKU_GAME_FINISHED';

ALTER TYPE "DevCoinSource" ADD VALUE 'TIC_TAC_TOE_WAGER';
ALTER TYPE "DevCoinSource" ADD VALUE 'TIC_TAC_TOE_PRIZE';
ALTER TYPE "DevCoinSource" ADD VALUE 'SUDOKU_EXTRA_ERRORS';

ALTER TYPE "TreasuryEntrySource" ADD VALUE 'TIC_TAC_TOE_MATCH_TAX';
ALTER TYPE "TreasuryEntrySource" ADD VALUE 'SUDOKU_EXTRA_ERRORS';

CREATE TYPE "TicTacToeRoomStatus" AS ENUM ('WAITING', 'ACTIVE', 'FINISHED', 'CANCELLED');
CREATE TYPE "TicTacToeMark" AS ENUM ('X', 'O');
CREATE TYPE "SudokuDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD', 'EXPERT', 'MASTER');
CREATE TYPE "SudokuGameStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'FAILED');

ALTER TABLE "PongRoom" ALTER COLUMN "roomFee" SET DEFAULT 0;
ALTER TABLE "PongRoom" DROP CONSTRAINT "PongRoom_wager_check";
ALTER TABLE "PongRoom" DROP CONSTRAINT "PongRoom_room_fee_check";
ALTER TABLE "PongRoom" ADD CONSTRAINT "PongRoom_wager_check" CHECK ("wager" BETWEEN 10 AND 500);
ALTER TABLE "PongRoom" ADD CONSTRAINT "PongRoom_room_fee_check" CHECK ("roomFee" >= 0);

CREATE TABLE "TicTacToeRoom" (
  "id" UUID NOT NULL,
  "code" VARCHAR(6) NOT NULL,
  "creationKey" TEXT NOT NULL,
  "ownerId" UUID NOT NULL,
  "guestId" UUID,
  "status" "TicTacToeRoomStatus" NOT NULL DEFAULT 'WAITING',
  "wager" INTEGER NOT NULL,
  "round" INTEGER NOT NULL DEFAULT 1,
  "board" VARCHAR(9) NOT NULL DEFAULT '---------',
  "nextMark" "TicTacToeMark" NOT NULL DEFAULT 'X',
  "ownerMark" "TicTacToeMark" NOT NULL DEFAULT 'X',
  "escrowBalance" INTEGER NOT NULL DEFAULT 0,
  "winnerId" UUID,
  "isDraw" BOOLEAN NOT NULL DEFAULT false,
  "winnerPayout" INTEGER NOT NULL DEFAULT 0,
  "taxAmount" INTEGER NOT NULL DEFAULT 0,
  "ownerRematchReady" BOOLEAN NOT NULL DEFAULT false,
  "guestRematchReady" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TicTacToeRoom_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TicTacToeRoom_code_check" CHECK ("code" ~ '^[0-9]{6}$'),
  CONSTRAINT "TicTacToeRoom_wager_check" CHECK ("wager" BETWEEN 11 AND 500),
  CONSTRAINT "TicTacToeRoom_board_check" CHECK ("board" ~ '^[XO-]{9}$'),
  CONSTRAINT "TicTacToeRoom_amounts_check" CHECK ("escrowBalance" >= 0 AND "winnerPayout" >= 0 AND "taxAmount" >= 0),
  CONSTRAINT "TicTacToeRoom_distinct_players_check" CHECK ("guestId" IS NULL OR "ownerId" <> "guestId")
);

CREATE TABLE "TicTacToeRound" (
  "id" UUID NOT NULL,
  "roomId" UUID NOT NULL,
  "round" INTEGER NOT NULL,
  "board" VARCHAR(9) NOT NULL,
  "winnerId" UUID,
  "winnerMark" "TicTacToeMark",
  "isDraw" BOOLEAN NOT NULL DEFAULT false,
  "winnerPayout" INTEGER NOT NULL DEFAULT 0,
  "taxAmount" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "finishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicTacToeRound_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TicTacToeRound_board_check" CHECK ("board" ~ '^[XO-]{9}$'),
  CONSTRAINT "TicTacToeRound_amounts_check" CHECK ("winnerPayout" >= 0 AND "taxAmount" >= 0)
);

CREATE TABLE "SudokuGame" (
  "id" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "difficulty" "SudokuDifficulty" NOT NULL,
  "puzzle" VARCHAR(81) NOT NULL,
  "solution" VARCHAR(81) NOT NULL,
  "board" VARCHAR(81) NOT NULL,
  "status" "SudokuGameStatus" NOT NULL DEFAULT 'ACTIVE',
  "mistakes" INTEGER NOT NULL DEFAULT 0,
  "mistakeLimit" INTEGER NOT NULL,
  "hintsUsed" INTEGER NOT NULL DEFAULT 0,
  "extraMistakesPurchased" BOOLEAN NOT NULL DEFAULT false,
  "eligibleForRanking" BOOLEAN NOT NULL DEFAULT true,
  "xpReward" INTEGER NOT NULL,
  "elapsedSeconds" INTEGER,
  "completionKey" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SudokuGame_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SudokuGame_puzzle_check" CHECK ("puzzle" ~ '^[0-9]{81}$'),
  CONSTRAINT "SudokuGame_solution_check" CHECK ("solution" ~ '^[1-9]{81}$'),
  CONSTRAINT "SudokuGame_board_check" CHECK ("board" ~ '^[0-9]{81}$'),
  CONSTRAINT "SudokuGame_limits_check" CHECK ("mistakes" >= 0 AND "mistakeLimit" >= 1 AND "hintsUsed" BETWEEN 0 AND 3 AND "xpReward" > 0 AND ("elapsedSeconds" IS NULL OR "elapsedSeconds" > 0))
);

CREATE TABLE "SudokuAction" (
  "id" UUID NOT NULL,
  "gameId" UUID NOT NULL,
  "actionKey" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "cell" INTEGER,
  "value" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SudokuAction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SudokuAction_cell_check" CHECK ("cell" IS NULL OR "cell" BETWEEN 0 AND 80),
  CONSTRAINT "SudokuAction_value_check" CHECK ("value" IS NULL OR "value" BETWEEN 1 AND 9)
);

CREATE UNIQUE INDEX "TicTacToeRoom_code_key" ON "TicTacToeRoom"("code");
CREATE UNIQUE INDEX "TicTacToeRoom_creationKey_key" ON "TicTacToeRoom"("creationKey");
CREATE INDEX "TicTacToeRoom_ownerId_status_updatedAt_idx" ON "TicTacToeRoom"("ownerId", "status", "updatedAt");
CREATE INDEX "TicTacToeRoom_guestId_status_updatedAt_idx" ON "TicTacToeRoom"("guestId", "status", "updatedAt");
CREATE UNIQUE INDEX "TicTacToeRound_roomId_round_key" ON "TicTacToeRound"("roomId", "round");
CREATE INDEX "TicTacToeRound_winnerId_finishedAt_idx" ON "TicTacToeRound"("winnerId", "finishedAt");
CREATE UNIQUE INDEX "SudokuGame_completionKey_key" ON "SudokuGame"("completionKey");
CREATE INDEX "SudokuGame_studentId_status_startedAt_idx" ON "SudokuGame"("studentId", "status", "startedAt");
CREATE INDEX "SudokuGame_difficulty_status_eligibleForRanking_elapsedSeconds_idx" ON "SudokuGame"("difficulty", "status", "eligibleForRanking", "elapsedSeconds");
CREATE UNIQUE INDEX "SudokuAction_actionKey_key" ON "SudokuAction"("actionKey");
CREATE INDEX "SudokuAction_gameId_createdAt_idx" ON "SudokuAction"("gameId", "createdAt");

ALTER TABLE "TicTacToeRoom" ADD CONSTRAINT "TicTacToeRoom_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TicTacToeRoom" ADD CONSTRAINT "TicTacToeRoom_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TicTacToeRoom" ADD CONSTRAINT "TicTacToeRoom_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TicTacToeRound" ADD CONSTRAINT "TicTacToeRound_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "TicTacToeRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TicTacToeRound" ADD CONSTRAINT "TicTacToeRound_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SudokuGame" ADD CONSTRAINT "SudokuGame_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SudokuAction" ADD CONSTRAINT "SudokuAction_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "SudokuGame"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
