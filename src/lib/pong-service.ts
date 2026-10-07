import { randomInt } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  PONG_DAILY_ROOM_LIMIT,
  PONG_DISCONNECT_GRACE_MS,
  PONG_JOIN_REQUEST_TTL_MS,
  PONG_LOSER_XP_PENALTY,
  PONG_MAX_WAGER,
  PONG_MIN_WAGER,
  PONG_ROOM_FEE,
  PONG_WIN_SCORE,
  pongSettlement,
  type PongSeat,
} from "@/lib/pong-rules";
import { getSchoolDay } from "@/lib/school-day";
import { creditTreasury } from "@/lib/treasury";

type Tx = Prisma.TransactionClient;

export class PongError extends Error {}

const roomGraph = {
  owner: { select: { id: true, firstName: true, lastName: true, profileAvatar: true } },
  winner: { select: { id: true, firstName: true, lastName: true } },
  loser: { select: { id: true, firstName: true, lastName: true } },
  players: {
    orderBy: { seat: "asc" as const },
    include: { student: { select: { id: true, firstName: true, lastName: true, profileAvatar: true } } },
  },
  joinRequests: {
    where: { status: "PENDING" as const },
    orderBy: { createdAt: "asc" as const },
    include: { student: { select: { id: true, firstName: true, lastName: true, profileAvatar: true } } },
  },
} satisfies Prisma.PongRoomInclude;

type RoomGraph = Prisma.PongRoomGetPayload<{ include: typeof roomGraph }>;

export function makePongRoomCode() {
  return String(randomInt(100_000, 1_000_000));
}

async function assertGamesEnabled(tx: Tx) {
  const settings = await tx.appSetting.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
    select: { gamesEnabled: true },
  });
  if (!settings.gamesEnabled) throw new PongError("GAMES_DISABLED");
}

async function lockRoom(tx: Tx, roomId: string) {
  await tx.$queryRaw`SELECT "id" FROM "PongRoom" WHERE "id" = ${roomId}::uuid FOR UPDATE`;
}

async function roomWithGraph(tx: Tx, roomId: string) {
  return tx.pongRoom.findUniqueOrThrow({ where: { id: roomId }, include: roomGraph });
}

async function lockStudents(tx: Tx, studentIds: string[]) {
  const ordered = [...studentIds].sort();
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"::text IN (${Prisma.join(ordered)}) ORDER BY "id" FOR UPDATE`;
}

export function pongRoomDto(room: RoomGraph, viewerId: string) {
  const viewer = room.players.find((player) => player.studentId === viewerId);
  if (!viewer) throw new PongError("NOT_A_PLAYER");
  const settlement = pongSettlement(room.wager);
  return {
    id: room.id,
    code: room.code,
    status: room.status,
    wager: room.wager,
    roomFee: room.roomFee,
    ownerScore: room.ownerScore,
    guestScore: room.guestScore,
    scoreSequence: room.scoreSequence,
    winnerId: room.winnerId,
    loserId: room.loserId,
    finishReason: room.finishReason,
    winnerPayout: room.winnerPayout,
    taxAmount: room.taxAmount,
    startedAt: room.startedAt?.toISOString() ?? null,
    finishedAt: room.finishedAt?.toISOString() ?? null,
    createdAt: room.createdAt.toISOString(),
    isOwner: room.ownerId === viewerId,
    viewerSeat: viewer.seat,
    settlement,
    owner: room.owner,
    winner: room.winner,
    loser: room.loser,
    players: room.players.map((player) => ({
      id: player.id,
      studentId: player.studentId,
      seat: player.seat,
      status: player.status,
      connected: player.connected,
      disconnectedAt: player.disconnectedAt?.toISOString() ?? null,
      disconnectDeadline: player.disconnectedAt ? new Date(player.disconnectedAt.getTime() + PONG_DISCONNECT_GRACE_MS).toISOString() : null,
      payout: player.payout,
      student: player.student,
    })),
    joinRequests: room.ownerId === viewerId
      ? room.joinRequests.filter((request) => request.expiresAt > new Date()).map((request) => ({
          id: request.id,
          studentId: request.studentId,
          createdAt: request.createdAt.toISOString(),
          expiresAt: request.expiresAt.toISOString(),
          student: request.student,
        }))
      : [],
  };
}

export async function createPongRoom(
  tx: Tx,
  studentId: string,
  wager: number,
  requestId: string,
  code = makePongRoomCode(),
) {
  await assertGamesEnabled(tx);
  if (!Number.isInteger(wager) || wager < PONG_MIN_WAGER || wager > PONG_MAX_WAGER) throw new PongError("INVALID_WAGER");
  const creationKey = `pong:create:${studentId}:${requestId}`;
  const replay = await tx.pongRoom.findUnique({ where: { creationKey }, include: roomGraph });
  if (replay) return { room: replay, replayed: true };

  await lockStudents(tx, [studentId]);
  const existing = await tx.pongPlayer.findFirst({
    where: { studentId, status: { in: ["WAITING", "PLAYING"] }, room: { status: { in: ["WAITING", "ACTIVE"] } } },
    select: { room: { select: { id: true, code: true } } },
  });
  if (existing) throw new PongError(`ACTIVE_ROOM:${existing.room.id}:${existing.room.code}`);
  const pending = await tx.pongJoinRequest.findFirst({
    where: { studentId, status: "PENDING", expiresAt: { gt: new Date() }, room: { status: "WAITING" } },
    select: { room: { select: { code: true } } },
  });
  if (pending) throw new PongError(`PENDING_REQUEST:${pending.room.code}`);

  const creationDay = getSchoolDay().key;
  const createdToday = await tx.pongRoom.count({ where: { ownerId: studentId, creationDay } });
  if (createdToday >= PONG_DAILY_ROOM_LIMIT) throw new PongError("DAILY_ROOM_LIMIT");
  const debit = await tx.user.updateMany({
    where: { id: studentId, role: "STUDENT", status: "ACTIVE", devCoins: { gte: PONG_ROOM_FEE + wager } },
    data: { devCoins: { decrement: PONG_ROOM_FEE } },
  });
  if (debit.count !== 1) throw new PongError("INSUFFICIENT_DEV_COINS");

  const room = await tx.pongRoom.create({
    data: {
      code,
      creationKey,
      ownerId: studentId,
      wager,
      roomFee: PONG_ROOM_FEE,
      creationDay,
      players: { create: { studentId, seat: "OWNER" } },
    },
  });
  const feeEntry = await tx.devCoinEntry.create({
    data: {
      studentId,
      authorId: studentId,
      delta: -PONG_ROOM_FEE,
      reason: `Abertura da sala Pong ${code}`,
      source: "PONG_ROOM_FEE",
      idempotencyKey: `${creationKey}:fee`,
    },
  });
  await creditTreasury(tx, PONG_ROOM_FEE, {
    reason: `Taxa de abertura da sala Pong ${code}`,
    source: "PONG_ROOM_FEE",
    idempotencyKey: `${creationKey}:treasury`,
    devCoinEntryId: feeEntry.id,
  });
  await tx.auditLog.create({
    data: { actorId: studentId, targetId: studentId, event: "PONG_ROOM_CREATED", details: { roomId: room.id, code, wager, roomFee: PONG_ROOM_FEE, creationDay } },
  });
  return { room: await roomWithGraph(tx, room.id), replayed: false };
}

export async function requestPongJoin(tx: Tx, studentId: string, code: string, requestId: string) {
  await assertGamesEnabled(tx);
  const normalized = code.trim();
  if (!/^\d{6}$/.test(normalized)) throw new PongError("INVALID_CODE");
  const idempotencyKey = `pong:join-request:${studentId}:${requestId}`;
  const replay = await tx.pongJoinRequest.findUnique({ where: { idempotencyKey }, include: { room: true } });
  if (replay) return { request: replay, replayed: true };

  const found = await tx.pongRoom.findUnique({ where: { code: normalized }, select: { id: true } });
  if (!found) throw new PongError("ROOM_NOT_FOUND");
  await lockRoom(tx, found.id);
  await tx.pongJoinRequest.updateMany({
    where: { roomId: found.id, status: "PENDING", expiresAt: { lte: new Date() } },
    data: { status: "EXPIRED", respondedAt: new Date() },
  });
  const room = await tx.pongRoom.findUniqueOrThrow({ where: { id: found.id }, include: { players: true } });
  if (room.status !== "WAITING" || room.players.length >= 2) throw new PongError("ROOM_NOT_JOINABLE");
  if (room.ownerId === studentId) throw new PongError("OWN_ROOM");
  const active = await tx.pongPlayer.findFirst({ where: { studentId, status: { in: ["WAITING", "PLAYING"] } }, select: { roomId: true } });
  if (active) throw new PongError("ALREADY_IN_ROOM");
  const otherPending = await tx.pongJoinRequest.findFirst({
    where: { studentId, status: "PENDING", expiresAt: { gt: new Date() }, room: { status: "WAITING" } },
    select: { room: { select: { code: true } } },
  });
  if (otherPending) throw new PongError(`PENDING_REQUEST:${otherPending.room.code}`);
  const student = await tx.user.findFirst({ where: { id: studentId, role: "STUDENT", status: "ACTIVE" }, select: { devCoins: true } });
  if (!student || student.devCoins < room.wager) throw new PongError("INSUFFICIENT_DEV_COINS");

  const request = await tx.pongJoinRequest.create({
    data: { roomId: room.id, studentId, idempotencyKey, expiresAt: new Date(Date.now() + PONG_JOIN_REQUEST_TTL_MS) },
  });
  await tx.auditLog.create({
    data: { actorId: studentId, targetId: room.ownerId, event: "PONG_JOIN_REQUESTED", details: { roomId: room.id, code: room.code, requestId: request.id } },
  });
  return { request, replayed: false };
}

export async function respondToPongJoin(tx: Tx, ownerId: string, roomId: string, requestId: string, accept: boolean) {
  await assertGamesEnabled(tx);
  await lockRoom(tx, roomId);
  const room = await tx.pongRoom.findUniqueOrThrow({ where: { id: roomId }, include: { players: true } });
  if (room.ownerId !== ownerId) throw new PongError("ONLY_OWNER");
  if (room.status !== "WAITING") throw new PongError("ROOM_NOT_JOINABLE");
  const request = await tx.pongJoinRequest.findUnique({ where: { id: requestId }, include: { student: { select: { devCoins: true, status: true } } } });
  if (!request || request.roomId !== roomId || request.status !== "PENDING") throw new PongError("JOIN_REQUEST_UNAVAILABLE");
  if (request.expiresAt <= new Date()) {
    await tx.pongJoinRequest.update({ where: { id: request.id }, data: { status: "EXPIRED", respondedAt: new Date() } });
    throw new PongError("JOIN_REQUEST_UNAVAILABLE");
  }
  if (!accept) {
    await tx.pongJoinRequest.update({ where: { id: request.id }, data: { status: "DECLINED", respondedAt: new Date() } });
    await tx.auditLog.create({ data: { actorId: ownerId, targetId: request.studentId, event: "PONG_JOIN_RESPONDED", details: { roomId, requestId, accepted: false } } });
    return { accepted: false, room: await roomWithGraph(tx, roomId) };
  }
  if (room.players.length >= 2) throw new PongError("ROOM_FULL");
  if (request.student.status !== "ACTIVE" || request.student.devCoins < room.wager) throw new PongError("GUEST_INSUFFICIENT_DEV_COINS");
  const otherRoom = await tx.pongPlayer.findFirst({ where: { studentId: request.studentId, status: { in: ["WAITING", "PLAYING"] } }, select: { id: true } });
  if (otherRoom) throw new PongError("GUEST_ALREADY_IN_ROOM");
  await tx.pongPlayer.create({ data: { roomId, studentId: request.studentId, seat: "GUEST" } });
  await tx.pongJoinRequest.update({ where: { id: request.id }, data: { status: "APPROVED", respondedAt: new Date() } });
  await tx.pongJoinRequest.updateMany({
    where: { roomId, id: { not: request.id }, status: "PENDING" },
    data: { status: "DECLINED", respondedAt: new Date() },
  });
  await tx.auditLog.create({ data: { actorId: ownerId, targetId: request.studentId, event: "PONG_JOIN_RESPONDED", details: { roomId, requestId, accepted: true } } });
  return { accepted: true, room: await roomWithGraph(tx, roomId) };
}

export async function startPongRoom(tx: Tx, ownerId: string, roomId: string) {
  await assertGamesEnabled(tx);
  await lockRoom(tx, roomId);
  const room = await roomWithGraph(tx, roomId);
  if (room.ownerId !== ownerId) throw new PongError("ONLY_OWNER");
  if (room.status !== "WAITING") throw new PongError("ROOM_ALREADY_STARTED");
  if (room.players.length !== 2) throw new PongError("NOT_ENOUGH_PLAYERS");
  if (room.players.some((player) => !player.connected)) throw new PongError("PLAYER_NOT_CONNECTED");
  const studentIds = room.players.map((player) => player.studentId);
  await lockStudents(tx, studentIds);
  const students = await tx.user.findMany({ where: { id: { in: studentIds }, role: "STUDENT", status: "ACTIVE" }, select: { id: true, devCoins: true } });
  if (students.length !== 2) throw new PongError("PLAYER_UNAVAILABLE");
  const insufficient = students.find((student) => student.devCoins < room.wager);
  if (insufficient) throw new PongError(insufficient.id === ownerId ? "INSUFFICIENT_DEV_COINS" : "GUEST_INSUFFICIENT_DEV_COINS");

  for (const player of room.players) {
    const debit = await tx.user.updateMany({ where: { id: player.studentId, devCoins: { gte: room.wager } }, data: { devCoins: { decrement: room.wager } } });
    if (debit.count !== 1) throw new PongError(player.studentId === ownerId ? "INSUFFICIENT_DEV_COINS" : "GUEST_INSUFFICIENT_DEV_COINS");
    await tx.devCoinEntry.create({
      data: {
        studentId: player.studentId,
        authorId: player.studentId,
        delta: -room.wager,
        reason: `Aposta confirmada na sala Pong ${room.code}`,
        source: "PONG_WAGER",
        idempotencyKey: `pong:${room.id}:stake:${player.studentId}`,
      },
    });
  }
  await tx.pongPlayer.updateMany({ where: { roomId }, data: { status: "PLAYING", stake: room.wager } });
  await tx.pongRoom.update({ where: { id: roomId }, data: { status: "ACTIVE", escrowBalance: room.wager * 2, startedAt: new Date() } });
  await tx.auditLog.create({ data: { actorId: ownerId, targetId: ownerId, event: "PONG_MATCH_STARTED", details: { roomId, code: room.code, wager: room.wager, escrow: room.wager * 2 } } });
  return roomWithGraph(tx, roomId);
}

export async function cancelPongRoom(tx: Tx, ownerId: string, roomId: string) {
  await lockRoom(tx, roomId);
  const room = await roomWithGraph(tx, roomId);
  if (room.ownerId !== ownerId) throw new PongError("ONLY_OWNER");
  if (room.status !== "WAITING") throw new PongError("ROOM_ALREADY_STARTED");
  await tx.pongPlayer.updateMany({ where: { roomId }, data: { status: "LEFT", connected: false } });
  await tx.pongJoinRequest.updateMany({ where: { roomId, status: "PENDING" }, data: { status: "EXPIRED", respondedAt: new Date() } });
  await tx.pongRoom.update({ where: { id: roomId }, data: { status: "CANCELLED", cancelledAt: new Date() } });
  await tx.auditLog.create({ data: { actorId: ownerId, targetId: ownerId, event: "PONG_ROOM_CANCELLED", details: { roomId, code: room.code, roomFeeRefunded: false } } });
  return roomWithGraph(tx, roomId);
}

async function settlePongRoom(tx: Tx, room: RoomGraph, winnerId: string, loserId: string, finishReason: "SCORE" | "DISCONNECTION" | "FORFEIT") {
  if (room.status === "FINISHED") return room;
  if (room.status !== "ACTIVE") throw new PongError("ROOM_NOT_ACTIVE");
  const winner = room.players.find((player) => player.studentId === winnerId);
  const loser = room.players.find((player) => player.studentId === loserId);
  if (!winner || !loser || winnerId === loserId) throw new PongError("INVALID_RESULT");
  const { winnerPayout, taxAmount } = pongSettlement(room.wager);

  await tx.user.update({ where: { id: winnerId }, data: { devCoins: { increment: winnerPayout } } });
  await tx.devCoinEntry.create({
    data: { studentId: winnerId, delta: winnerPayout, reason: `Vitória no Pong — sala ${room.code}`, source: "PONG_PRIZE", idempotencyKey: `pong:${room.id}:payout:${winnerId}` },
  });
  await tx.user.update({ where: { id: loserId }, data: { xp: { decrement: PONG_LOSER_XP_PENALTY } } });
  await tx.xpEntry.create({
    data: { studentId: loserId, delta: -PONG_LOSER_XP_PENALTY, reason: `${finishReason === "DISCONNECTION" ? "Derrota por desconexão" : finishReason === "FORFEIT" ? "Desistência" : "Derrota"} no Pong — sala ${room.code}`, source: "PONG_RESULT", idempotencyKey: `pong:${room.id}:loser-xp:${loserId}` },
  });
  await creditTreasury(tx, taxAmount, { reason: `Imposto da partida Pong ${room.code}`, source: "PONG_MATCH_TAX", idempotencyKey: `pong:${room.id}:tax` });
  await tx.pongPlayer.update({ where: { id: winner.id }, data: { status: "FINISHED", payout: winnerPayout, connected: false } });
  await tx.pongPlayer.update({ where: { id: loser.id }, data: { status: finishReason === "SCORE" ? "FINISHED" : "FORFEITED", connected: false } });
  await tx.pongRoom.update({
    where: { id: room.id },
    data: { status: "FINISHED", winnerId, loserId, finishReason, winnerPayout, taxAmount, escrowBalance: 0, finishedAt: new Date() },
  });
  await tx.auditLog.create({
    data: { actorId: winnerId, targetId: loserId, event: "PONG_MATCH_FINISHED", details: { roomId: room.id, code: room.code, finishReason, winnerId, loserId, winnerPayout, taxAmount, loserXp: -PONG_LOSER_XP_PENALTY, ownerScore: room.ownerScore, guestScore: room.guestScore } },
  });
  return roomWithGraph(tx, room.id);
}

export async function recordPongPoint(tx: Tx, roomId: string, scorerSeat: PongSeat, sequence: number) {
  await lockRoom(tx, roomId);
  const room = await roomWithGraph(tx, roomId);
  if (room.status !== "ACTIVE") return room;
  if (sequence <= room.scoreSequence) return room;
  if (sequence !== room.scoreSequence + 1) throw new PongError("INVALID_SCORE_SEQUENCE");
  const scorer = room.players.find((player) => player.seat === scorerSeat);
  const opponent = room.players.find((player) => player.seat !== scorerSeat);
  if (!scorer || !opponent) throw new PongError("PLAYER_UNAVAILABLE");
  const ownerScore = room.ownerScore + (scorerSeat === "OWNER" ? 1 : 0);
  const guestScore = room.guestScore + (scorerSeat === "GUEST" ? 1 : 0);
  await tx.pongPoint.create({ data: { roomId, scorerId: scorer.studentId, sequence, ownerScore, guestScore } });
  await tx.pongRoom.update({ where: { id: roomId }, data: { ownerScore, guestScore, scoreSequence: sequence } });
  const updated = await roomWithGraph(tx, roomId);
  if (ownerScore >= PONG_WIN_SCORE || guestScore >= PONG_WIN_SCORE) return settlePongRoom(tx, updated, scorer.studentId, opponent.studentId, "SCORE");
  return updated;
}

export async function forfeitPongRoom(tx: Tx, studentId: string, roomId: string) {
  await lockRoom(tx, roomId);
  const room = await roomWithGraph(tx, roomId);
  if (room.status !== "ACTIVE") throw new PongError("ROOM_NOT_ACTIVE");
  const loser = room.players.find((player) => player.studentId === studentId);
  const winner = room.players.find((player) => player.studentId !== studentId);
  if (!loser || !winner) throw new PongError("NOT_A_PLAYER");
  return settlePongRoom(tx, room, winner.studentId, loser.studentId, "FORFEIT");
}

export async function setPongPlayerConnection(tx: Tx, studentId: string, roomId: string, connected: boolean) {
  const membership = await tx.pongPlayer.findFirst({ where: { roomId, studentId, status: { in: ["WAITING", "PLAYING"] } }, select: { id: true } });
  if (!membership) return false;
  await tx.pongPlayer.update({
    where: { id: membership.id },
    data: connected
      ? { connected: true, lastSeenAt: new Date(), disconnectedAt: null }
      : { connected: false, disconnectedAt: new Date() },
  });
  return true;
}

export async function settleExpiredPongDisconnect(tx: Tx, roomId: string) {
  await lockRoom(tx, roomId);
  const room = await roomWithGraph(tx, roomId);
  if (room.status !== "ACTIVE") return room;
  const deadline = Date.now() - PONG_DISCONNECT_GRACE_MS;
  const loser = room.players.find((player) => !player.connected && player.disconnectedAt && player.disconnectedAt.getTime() <= deadline);
  if (!loser) return room;
  const winner = room.players.find((player) => player.studentId !== loser.studentId && player.connected);
  if (!winner) return room;
  return settlePongRoom(tx, room, winner.studentId, loser.studentId, "DISCONNECTION");
}

export async function getPongRoomForStudent(studentId: string, roomId: string) {
  const room = await prisma.pongRoom.findUnique({ where: { id: roomId }, include: roomGraph });
  if (!room) throw new PongError("ROOM_NOT_FOUND");
  return pongRoomDto(room, studentId);
}

export async function getPongLobby(studentId: string) {
  const day = getSchoolDay().key;
  const [settings, membership, pendingRequest, createdToday, student] = await Promise.all([
    prisma.appSetting.upsert({ where: { id: 1 }, create: { id: 1 }, update: {}, select: { gamesEnabled: true } }),
    prisma.pongPlayer.findFirst({
      where: { studentId, status: { in: ["WAITING", "PLAYING"] }, room: { status: { in: ["WAITING", "ACTIVE"] } } },
      select: { roomId: true, room: { select: { code: true, status: true } } },
    }),
    prisma.pongJoinRequest.findFirst({
      where: { studentId, status: "PENDING", expiresAt: { gt: new Date() }, room: { status: "WAITING" } },
      orderBy: { createdAt: "desc" },
      select: { id: true, expiresAt: true, room: { select: { id: true, code: true, wager: true, owner: { select: { firstName: true, lastName: true } } } } },
    }),
    prisma.pongRoom.count({ where: { ownerId: studentId, creationDay: day } }),
    prisma.user.findUniqueOrThrow({ where: { id: studentId }, select: { devCoins: true, xp: true } }),
  ]);
  return {
    gamesEnabled: settings.gamesEnabled,
    currentRoom: membership ? { id: membership.roomId, code: membership.room.code, status: membership.room.status } : null,
    pendingRequest: pendingRequest
      ? { id: pendingRequest.id, expiresAt: pendingRequest.expiresAt.toISOString(), room: pendingRequest.room }
      : null,
    createdToday,
    remainingCreations: Math.max(0, PONG_DAILY_ROOM_LIMIT - createdToday),
    devCoins: student.devCoins,
    xp: student.xp,
  };
}
