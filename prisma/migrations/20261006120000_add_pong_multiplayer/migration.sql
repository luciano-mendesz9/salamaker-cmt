ALTER TYPE "XpSource" ADD VALUE 'PONG_RESULT';

ALTER TYPE "AuditEvent" ADD VALUE 'PONG_ROOM_CREATED';
ALTER TYPE "AuditEvent" ADD VALUE 'PONG_JOIN_REQUESTED';
ALTER TYPE "AuditEvent" ADD VALUE 'PONG_JOIN_RESPONDED';
ALTER TYPE "AuditEvent" ADD VALUE 'PONG_MATCH_STARTED';
ALTER TYPE "AuditEvent" ADD VALUE 'PONG_MATCH_FINISHED';
ALTER TYPE "AuditEvent" ADD VALUE 'PONG_ROOM_CANCELLED';

ALTER TYPE "DevCoinSource" ADD VALUE 'PONG_ROOM_FEE';
ALTER TYPE "DevCoinSource" ADD VALUE 'PONG_WAGER';
ALTER TYPE "DevCoinSource" ADD VALUE 'PONG_PRIZE';

ALTER TYPE "TreasuryEntrySource" ADD VALUE 'PONG_ROOM_FEE';
ALTER TYPE "TreasuryEntrySource" ADD VALUE 'PONG_MATCH_TAX';

CREATE TYPE "PongRoomStatus" AS ENUM ('WAITING', 'ACTIVE', 'FINISHED', 'CANCELLED');
CREATE TYPE "PongPlayerSeat" AS ENUM ('OWNER', 'GUEST');
CREATE TYPE "PongPlayerStatus" AS ENUM ('WAITING', 'PLAYING', 'FINISHED', 'FORFEITED', 'LEFT');
CREATE TYPE "PongJoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'EXPIRED');
CREATE TYPE "PongFinishReason" AS ENUM ('SCORE', 'DISCONNECTION', 'FORFEIT');

ALTER TABLE "AppSetting" ADD COLUMN "gamesEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "PongRoom" (
  "id" UUID NOT NULL,
  "code" VARCHAR(6) NOT NULL,
  "creationKey" TEXT NOT NULL,
  "ownerId" UUID NOT NULL,
  "status" "PongRoomStatus" NOT NULL DEFAULT 'WAITING',
  "wager" INTEGER NOT NULL,
  "roomFee" INTEGER NOT NULL DEFAULT 50,
  "creationDay" TEXT NOT NULL,
  "escrowBalance" INTEGER NOT NULL DEFAULT 0,
  "ownerScore" INTEGER NOT NULL DEFAULT 0,
  "guestScore" INTEGER NOT NULL DEFAULT 0,
  "scoreSequence" INTEGER NOT NULL DEFAULT 0,
  "winnerId" UUID,
  "loserId" UUID,
  "finishReason" "PongFinishReason",
  "winnerPayout" INTEGER NOT NULL DEFAULT 0,
  "taxAmount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PongRoom_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PongRoom_code_check" CHECK ("code" ~ '^[0-9]{6}$'),
  CONSTRAINT "PongRoom_wager_check" CHECK ("wager" BETWEEN 10 AND 100),
  CONSTRAINT "PongRoom_room_fee_check" CHECK ("roomFee" = 50),
  CONSTRAINT "PongRoom_nonnegative_amounts_check" CHECK ("escrowBalance" >= 0 AND "winnerPayout" >= 0 AND "taxAmount" >= 0),
  CONSTRAINT "PongRoom_scores_check" CHECK ("ownerScore" BETWEEN 0 AND 10 AND "guestScore" BETWEEN 0 AND 10),
  CONSTRAINT "PongRoom_distinct_result_players_check" CHECK ("winnerId" IS NULL OR "loserId" IS NULL OR "winnerId" <> "loserId")
);

CREATE TABLE "PongPlayer" (
  "id" UUID NOT NULL,
  "roomId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "seat" "PongPlayerSeat" NOT NULL,
  "status" "PongPlayerStatus" NOT NULL DEFAULT 'WAITING',
  "stake" INTEGER NOT NULL DEFAULT 0,
  "payout" INTEGER NOT NULL DEFAULT 0,
  "connected" BOOLEAN NOT NULL DEFAULT false,
  "lastSeenAt" TIMESTAMP(3),
  "disconnectedAt" TIMESTAMP(3),
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PongPlayer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PongPlayer_amounts_check" CHECK ("stake" >= 0 AND "payout" >= 0)
);

CREATE TABLE "PongJoinRequest" (
  "id" UUID NOT NULL,
  "roomId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "status" "PongJoinRequestStatus" NOT NULL DEFAULT 'PENDING',
  "idempotencyKey" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "respondedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PongJoinRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PongPoint" (
  "id" UUID NOT NULL,
  "roomId" UUID NOT NULL,
  "scorerId" UUID NOT NULL,
  "sequence" INTEGER NOT NULL,
  "ownerScore" INTEGER NOT NULL,
  "guestScore" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PongPoint_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PongPoint_sequence_check" CHECK ("sequence" > 0),
  CONSTRAINT "PongPoint_scores_check" CHECK ("ownerScore" BETWEEN 0 AND 10 AND "guestScore" BETWEEN 0 AND 10)
);

CREATE UNIQUE INDEX "PongRoom_code_key" ON "PongRoom"("code");
CREATE UNIQUE INDEX "PongRoom_creationKey_key" ON "PongRoom"("creationKey");
CREATE INDEX "PongRoom_ownerId_creationDay_createdAt_idx" ON "PongRoom"("ownerId", "creationDay", "createdAt");
CREATE INDEX "PongRoom_status_updatedAt_idx" ON "PongRoom"("status", "updatedAt");

CREATE UNIQUE INDEX "PongPlayer_roomId_studentId_key" ON "PongPlayer"("roomId", "studentId");
CREATE UNIQUE INDEX "PongPlayer_roomId_seat_key" ON "PongPlayer"("roomId", "seat");
CREATE INDEX "PongPlayer_studentId_status_idx" ON "PongPlayer"("studentId", "status");
CREATE UNIQUE INDEX "PongPlayer_one_open_room_per_student" ON "PongPlayer"("studentId") WHERE "status" IN ('WAITING', 'PLAYING');

CREATE UNIQUE INDEX "PongJoinRequest_idempotencyKey_key" ON "PongJoinRequest"("idempotencyKey");
CREATE INDEX "PongJoinRequest_roomId_status_createdAt_idx" ON "PongJoinRequest"("roomId", "status", "createdAt");
CREATE INDEX "PongJoinRequest_studentId_status_createdAt_idx" ON "PongJoinRequest"("studentId", "status", "createdAt");
CREATE UNIQUE INDEX "PongJoinRequest_one_pending_per_student" ON "PongJoinRequest"("roomId", "studentId") WHERE "status" = 'PENDING';

CREATE UNIQUE INDEX "PongPoint_roomId_sequence_key" ON "PongPoint"("roomId", "sequence");
CREATE INDEX "PongPoint_roomId_createdAt_idx" ON "PongPoint"("roomId", "createdAt");

ALTER TABLE "PongRoom" ADD CONSTRAINT "PongRoom_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PongRoom" ADD CONSTRAINT "PongRoom_winnerId_fkey"
FOREIGN KEY ("winnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PongRoom" ADD CONSTRAINT "PongRoom_loserId_fkey"
FOREIGN KEY ("loserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PongPlayer" ADD CONSTRAINT "PongPlayer_roomId_fkey"
FOREIGN KEY ("roomId") REFERENCES "PongRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PongPlayer" ADD CONSTRAINT "PongPlayer_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PongJoinRequest" ADD CONSTRAINT "PongJoinRequest_roomId_fkey"
FOREIGN KEY ("roomId") REFERENCES "PongRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PongJoinRequest" ADD CONSTRAINT "PongJoinRequest_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PongPoint" ADD CONSTRAINT "PongPoint_roomId_fkey"
FOREIGN KEY ("roomId") REFERENCES "PongRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PongPoint" ADD CONSTRAINT "PongPoint_scorerId_fkey"
FOREIGN KEY ("scorerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
