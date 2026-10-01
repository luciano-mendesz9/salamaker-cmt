BEGIN;

ALTER TYPE "XpSource" ADD VALUE 'LUDO_ROOM';
ALTER TYPE "XpSource" ADD VALUE 'LUDO_INVITE';
ALTER TYPE "XpSource" ADD VALUE 'LUDO_RESULT';
ALTER TYPE "XpSource" ADD VALUE 'LUDO_FORFEIT';

ALTER TYPE "AuditEvent" ADD VALUE 'LUDO_ROOM_CREATED';
ALTER TYPE "AuditEvent" ADD VALUE 'LUDO_ROOM_JOINED';
ALTER TYPE "AuditEvent" ADD VALUE 'LUDO_INVITE_SENT';
ALTER TYPE "AuditEvent" ADD VALUE 'LUDO_MATCH_STARTED';
ALTER TYPE "AuditEvent" ADD VALUE 'LUDO_MATCH_PAUSED';
ALTER TYPE "AuditEvent" ADD VALUE 'LUDO_MATCH_FINISHED';
ALTER TYPE "AuditEvent" ADD VALUE 'LUDO_PLAYER_FORFEITED';

ALTER TYPE "DevCoinSource" ADD VALUE 'LUDO_ROOM_FEE';
ALTER TYPE "DevCoinSource" ADD VALUE 'LUDO_ESCROW';
ALTER TYPE "DevCoinSource" ADD VALUE 'LUDO_PRIZE';

ALTER TYPE "TreasuryEntrySource" ADD VALUE 'LUDO_ROOM_FEE';
ALTER TYPE "TreasuryEntrySource" ADD VALUE 'LUDO_SETTLEMENT';

CREATE TYPE "LudoRoomMode" AS ENUM ('HUMAN', 'BOT');
CREATE TYPE "LudoRoomStatus" AS ENUM ('WAITING', 'ACTIVE', 'PAUSED', 'FINISHED', 'CANCELLED');
CREATE TYPE "LudoPlayerKind" AS ENUM ('STUDENT', 'BOT');
CREATE TYPE "LudoPlayerStatus" AS ENUM ('JOINED', 'PLAYING', 'FINISHED', 'FORFEITED');
CREATE TYPE "LudoColor" AS ENUM ('RED', 'GREEN', 'YELLOW', 'BLUE');
CREATE TYPE "LudoInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');
CREATE TYPE "LudoMoveKind" AS ENUM ('ROLL', 'MOVE', 'AUTO_ROLL', 'AUTO_MOVE', 'FORFEIT');

CREATE TABLE "LudoRoom" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "creationKey" TEXT NOT NULL,
  "ownerId" UUID NOT NULL,
  "mode" "LudoRoomMode" NOT NULL,
  "status" "LudoRoomStatus" NOT NULL DEFAULT 'WAITING',
  "wager" INTEGER NOT NULL,
  "roomFee" INTEGER NOT NULL DEFAULT 50,
  "maxPlayers" INTEGER NOT NULL DEFAULT 4,
  "botAdvantaged" BOOLEAN,
  "escrowBalance" INTEGER NOT NULL DEFAULT 0,
  "initialPlayerCount" INTEGER,
  "currentSeat" INTEGER NOT NULL DEFAULT 0,
  "currentRoll" INTEGER,
  "consecutiveSixes" INTEGER NOT NULL DEFAULT 0,
  "pauseRequestCount" INTEGER NOT NULL DEFAULT 0,
  "turnDeadline" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "pausedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LudoRoom_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LudoRoom_wager_check" CHECK ("wager" BETWEEN 10 AND 100),
  CONSTRAINT "LudoRoom_roomFee_check" CHECK ("roomFee" = 50),
  CONSTRAINT "LudoRoom_maxPlayers_check" CHECK ("maxPlayers" BETWEEN 2 AND 4),
  CONSTRAINT "LudoRoom_escrow_check" CHECK ("escrowBalance" >= 0),
  CONSTRAINT "LudoRoom_roll_check" CHECK ("currentRoll" IS NULL OR "currentRoll" BETWEEN 1 AND 6)
);

CREATE TABLE "LudoPlayer" (
  "id" UUID NOT NULL,
  "roomId" UUID NOT NULL,
  "studentId" UUID,
  "kind" "LudoPlayerKind" NOT NULL DEFAULT 'STUDENT',
  "color" "LudoColor" NOT NULL,
  "seat" INTEGER NOT NULL,
  "status" "LudoPlayerStatus" NOT NULL DEFAULT 'JOINED',
  "pieces" JSONB NOT NULL DEFAULT '[-1,-1,-1,-1]',
  "stake" INTEGER NOT NULL,
  "payout" INTEGER NOT NULL DEFAULT 0,
  "finishPosition" INTEGER,
  "connected" BOOLEAN NOT NULL DEFAULT false,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3),
  "disconnectedAt" TIMESTAMP(3),
  "forfeitedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "LudoPlayer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LudoPlayer_identity_check" CHECK (
    ("kind" = 'STUDENT' AND "studentId" IS NOT NULL)
    OR ("kind" = 'BOT' AND "studentId" IS NULL)
  ),
  CONSTRAINT "LudoPlayer_seat_check" CHECK ("seat" BETWEEN 0 AND 3),
  CONSTRAINT "LudoPlayer_stake_check" CHECK ("stake" BETWEEN 10 AND 100),
  CONSTRAINT "LudoPlayer_payout_check" CHECK ("payout" >= 0),
  CONSTRAINT "LudoPlayer_finish_check" CHECK ("finishPosition" IS NULL OR "finishPosition" BETWEEN 1 AND 4)
);

CREATE TABLE "LudoMove" (
  "id" UUID NOT NULL,
  "roomId" UUID NOT NULL,
  "playerId" UUID NOT NULL,
  "capturedPlayerId" UUID,
  "sequence" INTEGER NOT NULL,
  "kind" "LudoMoveKind" NOT NULL,
  "roll" INTEGER,
  "pieceIndex" INTEGER,
  "fromPosition" INTEGER,
  "toPosition" INTEGER,
  "captured" JSONB,
  "autoReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LudoMove_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LudoMove_roll_check" CHECK ("roll" IS NULL OR "roll" BETWEEN 1 AND 6),
  CONSTRAINT "LudoMove_piece_check" CHECK ("pieceIndex" IS NULL OR "pieceIndex" BETWEEN 0 AND 3)
);

CREATE TABLE "LudoInvitation" (
  "id" UUID NOT NULL,
  "roomId" UUID NOT NULL,
  "inviterId" UUID NOT NULL,
  "inviteeId" UUID NOT NULL,
  "status" "LudoInvitationStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMP(3),
  CONSTRAINT "LudoInvitation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LudoInvitation_people_check" CHECK ("inviterId" <> "inviteeId")
);

CREATE TABLE "LudoInvitationBlock" (
  "id" UUID NOT NULL,
  "blockerId" UUID NOT NULL,
  "blockedId" UUID NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LudoInvitationBlock_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LudoInvitationBlock_people_check" CHECK ("blockerId" <> "blockedId")
);

CREATE UNIQUE INDEX "LudoRoom_code_key" ON "LudoRoom"("code");
CREATE UNIQUE INDEX "LudoRoom_creationKey_key" ON "LudoRoom"("creationKey");
CREATE INDEX "LudoRoom_status_createdAt_idx" ON "LudoRoom"("status", "createdAt");
CREATE INDEX "LudoRoom_ownerId_status_idx" ON "LudoRoom"("ownerId", "status");
CREATE UNIQUE INDEX "LudoPlayer_roomId_seat_key" ON "LudoPlayer"("roomId", "seat");
CREATE UNIQUE INDEX "LudoPlayer_roomId_studentId_key" ON "LudoPlayer"("roomId", "studentId");
CREATE INDEX "LudoPlayer_studentId_joinedAt_idx" ON "LudoPlayer"("studentId", "joinedAt");
CREATE INDEX "LudoPlayer_roomId_status_seat_idx" ON "LudoPlayer"("roomId", "status", "seat");
CREATE UNIQUE INDEX "LudoMove_roomId_sequence_key" ON "LudoMove"("roomId", "sequence");
CREATE INDEX "LudoMove_roomId_createdAt_idx" ON "LudoMove"("roomId", "createdAt");
CREATE INDEX "LudoInvitation_inviteeId_status_expiresAt_idx" ON "LudoInvitation"("inviteeId", "status", "expiresAt");
CREATE INDEX "LudoInvitation_roomId_status_idx" ON "LudoInvitation"("roomId", "status");
CREATE INDEX "LudoInvitation_inviterId_inviteeId_createdAt_idx" ON "LudoInvitation"("inviterId", "inviteeId", "createdAt");
CREATE UNIQUE INDEX "LudoInvitationBlock_blockerId_blockedId_key" ON "LudoInvitationBlock"("blockerId", "blockedId");
CREATE INDEX "LudoInvitationBlock_expiresAt_idx" ON "LudoInvitationBlock"("expiresAt");

ALTER TABLE "LudoRoom" ADD CONSTRAINT "LudoRoom_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LudoPlayer" ADD CONSTRAINT "LudoPlayer_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "LudoRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LudoPlayer" ADD CONSTRAINT "LudoPlayer_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LudoMove" ADD CONSTRAINT "LudoMove_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "LudoRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LudoMove" ADD CONSTRAINT "LudoMove_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "LudoPlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LudoMove" ADD CONSTRAINT "LudoMove_capturedPlayerId_fkey" FOREIGN KEY ("capturedPlayerId") REFERENCES "LudoPlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LudoInvitation" ADD CONSTRAINT "LudoInvitation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "LudoRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LudoInvitation" ADD CONSTRAINT "LudoInvitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LudoInvitation" ADD CONSTRAINT "LudoInvitation_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LudoInvitationBlock" ADD CONSTRAINT "LudoInvitationBlock_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LudoInvitationBlock" ADD CONSTRAINT "LudoInvitationBlock_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
