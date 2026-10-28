import { randomInt } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getSchoolDay } from "@/lib/school-day";
import { creditTreasury } from "@/lib/treasury";
import { BATTLESHIP_DAILY_MATCH_LIMIT, BATTLESHIP_DAILY_OPPONENT_LIMIT, BATTLESHIP_HIT_XP_PENALTY, BATTLESHIP_MAX_WAGER, BATTLESHIP_MIN_WAGER, BATTLESHIP_SINK_XP_PENALTY, BATTLESHIP_SINK_XP_REWARD, BATTLESHIP_WAGER_STEP, battleshipSettlement, fireAtFleet, generateBattleshipFleet, isBattleshipSunk, parseBattleshipFleet } from "@/lib/battleship-rules";

type Tx = Prisma.TransactionClient;
export class BattleshipError extends Error {}

const roomGraph = {
  owner: { select: { id: true, firstName: true, lastName: true, profileAvatar: true } },
  guest: { select: { id: true, firstName: true, lastName: true, profileAvatar: true } },
  boards: { orderBy: { createdAt: "asc" as const } },
  shots: { orderBy: { sequence: "asc" as const } },
} satisfies Prisma.BattleshipRoomInclude;
type RoomGraph = Prisma.BattleshipRoomGetPayload<{ include: typeof roomGraph }>;

export function makeBattleshipCode() { return String(randomInt(100_000, 1_000_000)); }
function secureRandom() { return randomInt(0, 1_000_000) / 1_000_000; }

async function assertGamesEnabled(tx: Tx) {
  const settings = await tx.appSetting.upsert({ where: { id: 1 }, create: { id: 1 }, update: {}, select: { gamesEnabled: true } });
  if (!settings.gamesEnabled) throw new BattleshipError("GAMES_DISABLED");
}

async function lockRoom(tx: Tx, roomId: string) {
  await tx.$queryRaw`SELECT "id" FROM "BattleshipRoom" WHERE "id" = ${roomId}::uuid FOR UPDATE`;
}

async function lockStudents(tx: Tx, ids: string[]) {
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"::text IN (${Prisma.join([...ids].sort())}) ORDER BY "id" FOR UPDATE`;
}

async function getRoom(tx: Tx, roomId: string) {
  return tx.battleshipRoom.findUniqueOrThrow({ where: { id: roomId }, include: roomGraph });
}

async function schoolDay(tx: Tx) {
  const settings = await tx.appSetting.upsert({ where: { id: 1 }, create: { id: 1 }, update: {}, select: { timeZone: true } });
  return getSchoolDay(new Date(), settings.timeZone);
}

async function assertDailyLimits(tx: Tx, ownerId: string, guestId: string) {
  const day = await schoolDay(tx);
  const [ownerMatches, guestMatches, opponentMatches] = await Promise.all([
    tx.battleshipRoom.count({ where: { startedAt: { gte: day.start, lt: day.end }, OR: [{ ownerId }, { guestId: ownerId }] } }),
    tx.battleshipRoom.count({ where: { startedAt: { gte: day.start, lt: day.end }, OR: [{ ownerId: guestId }, { guestId }] } }),
    tx.battleshipRoom.count({ where: { startedAt: { gte: day.start, lt: day.end }, OR: [{ ownerId, guestId }, { ownerId: guestId, guestId: ownerId }] } }),
  ]);
  if (ownerMatches >= BATTLESHIP_DAILY_MATCH_LIMIT || guestMatches >= BATTLESHIP_DAILY_MATCH_LIMIT) throw new BattleshipError("DAILY_MATCH_LIMIT");
  if (opponentMatches >= BATTLESHIP_DAILY_OPPONENT_LIMIT) throw new BattleshipError("OPPONENT_DAILY_LIMIT");
}

export function battleshipRoomDto(room: RoomGraph, viewerId: string) {
  const isOwner = room.ownerId === viewerId;
  const opponentId = isOwner ? room.guestId : room.ownerId;
  if (!isOwner && room.guestId !== viewerId) throw new BattleshipError("NOT_A_PLAYER");
  const ownBoard = room.boards.find((board) => board.studentId === viewerId);
  const opponentBoard = room.boards.find((board) => board.studentId === opponentId);
  const ownFleet = ownBoard ? parseBattleshipFleet(ownBoard.ships) : [];
  const opponentFleet = opponentBoard ? parseBattleshipFleet(opponentBoard.ships).map((ship) => ({ id: ship.id, kind: ship.kind, label: ship.label, length: ship.length, sunk: isBattleshipSunk(ship) })) : [];
  return {
    id: room.id, code: room.code, status: room.status, wager: room.wager, escrowBalance: room.escrowBalance,
    currentTurnId: room.currentTurnId, winnerId: room.winnerId, loserId: room.loserId, winnerPayout: room.winnerPayout, taxAmount: room.taxAmount,
    isOwner, owner: room.owner, guest: room.guest, ownFleet, opponentFleet,
    shotsFired: room.shots.filter((shot) => shot.attackerId === viewerId).map((shot) => ({ cell: shot.cell, hit: shot.hit, sunkShip: shot.sunkShip, sequence: shot.sequence })),
    shotsReceived: room.shots.filter((shot) => shot.defenderId === viewerId).map((shot) => ({ cell: shot.cell, hit: shot.hit, sunkShip: shot.sunkShip, sequence: shot.sequence })),
    settlement: battleshipSettlement(room.wager),
    startedAt: room.startedAt?.toISOString() ?? null, finishedAt: room.finishedAt?.toISOString() ?? null,
  };
}

export async function createBattleshipRoom(tx: Tx, studentId: string, wager: number, requestId: string, code = makeBattleshipCode()) {
  await assertGamesEnabled(tx);
  if (!Number.isInteger(wager) || wager < BATTLESHIP_MIN_WAGER || wager > BATTLESHIP_MAX_WAGER || wager % BATTLESHIP_WAGER_STEP !== 0) throw new BattleshipError("INVALID_WAGER");
  const creationKey = `battleship:create:${studentId}:${requestId}`;
  const replay = await tx.battleshipRoom.findUnique({ where: { creationKey }, include: roomGraph });
  if (replay) return { room: replay, replayed: true };
  const existing = await tx.battleshipRoom.findFirst({ where: { status: { in: ["WAITING", "ACTIVE"] }, OR: [{ ownerId: studentId }, { guestId: studentId }] }, select: { id: true, code: true } });
  if (existing) throw new BattleshipError(`ACTIVE_ROOM:${existing.id}:${existing.code}`);
  const student = await tx.user.findFirst({ where: { id: studentId, role: "STUDENT", status: "ACTIVE" }, select: { devCoins: true } });
  if (!student || student.devCoins < wager) throw new BattleshipError("INSUFFICIENT_DEV_COINS");
  const room = await tx.battleshipRoom.create({ data: { code, creationKey, ownerId: studentId, wager }, include: roomGraph });
  await tx.auditLog.create({ data: { actorId: studentId, targetId: studentId, event: "BATTLESHIP_ROOM_CREATED", details: { roomId: room.id, code, wager } } });
  return { room, replayed: false };
}

async function debitStakes(tx: Tx, room: RoomGraph) {
  if (!room.guestId) throw new BattleshipError("NOT_ENOUGH_PLAYERS");
  await lockStudents(tx, [room.ownerId, room.guestId]);
  for (const studentId of [room.ownerId, room.guestId]) {
    const changed = await tx.user.updateMany({ where: { id: studentId, role: "STUDENT", status: "ACTIVE", devCoins: { gte: room.wager } }, data: { devCoins: { decrement: room.wager } } });
    if (changed.count !== 1) throw new BattleshipError(studentId === room.ownerId ? "INSUFFICIENT_DEV_COINS" : "GUEST_INSUFFICIENT_DEV_COINS");
    await tx.devCoinEntry.create({ data: { studentId, authorId: studentId, delta: -room.wager, reason: `Aposta na Batalha Naval — sala ${room.code}`, source: "BATTLESHIP_WAGER", idempotencyKey: `battleship:${room.id}:stake:${studentId}` } });
  }
}

export async function joinBattleshipRoom(tx: Tx, studentId: string, code: string, expectedWager: number) {
  await assertGamesEnabled(tx);
  const normalized = code.trim();
  if (!/^\d{6}$/.test(normalized)) throw new BattleshipError("INVALID_CODE");
  const found = await tx.battleshipRoom.findUnique({ where: { code: normalized }, select: { id: true } });
  if (!found) throw new BattleshipError("ROOM_NOT_FOUND");
  await lockRoom(tx, found.id);
  let room = await getRoom(tx, found.id);
  if (room.status !== "WAITING" || room.guestId) throw new BattleshipError("ROOM_NOT_JOINABLE");
  if (room.ownerId === studentId) throw new BattleshipError("OWN_ROOM");
  if (room.wager !== expectedWager) throw new BattleshipError("WAGER_CHANGED");
  const existing = await tx.battleshipRoom.findFirst({ where: { status: { in: ["WAITING", "ACTIVE"] }, OR: [{ ownerId: studentId }, { guestId: studentId }] }, select: { id: true } });
  if (existing) throw new BattleshipError("ALREADY_IN_ROOM");
  await assertDailyLimits(tx, room.ownerId, studentId);
  room = await tx.battleshipRoom.update({ where: { id: room.id }, data: { guestId: studentId }, include: roomGraph });
  await debitStakes(tx, room);
  const startedAt = new Date();
  const currentTurnId = randomInt(0, 2) === 0 ? room.ownerId : studentId;
  await tx.battleshipBoard.createMany({ data: [
    { roomId: room.id, studentId: room.ownerId, ships: generateBattleshipFleet(secureRandom) as unknown as Prisma.InputJsonValue },
    { roomId: room.id, studentId, ships: generateBattleshipFleet(secureRandom) as unknown as Prisma.InputJsonValue },
  ] });
  room = await tx.battleshipRoom.update({ where: { id: room.id }, data: { status: "ACTIVE", escrowBalance: room.wager * 2, currentTurnId, startedAt }, include: roomGraph });
  await tx.auditLog.create({ data: { actorId: studentId, targetId: room.ownerId, event: "BATTLESHIP_MATCH_STARTED", details: { roomId: room.id, code: room.code, wager: room.wager, firstPlayerId: currentTurnId } } });
  return room;
}

export async function getBattleshipRoomPreview(studentId: string, code: string) {
  if (!/^\d{6}$/.test(code)) throw new BattleshipError("INVALID_CODE");
  const room = await prisma.battleshipRoom.findUnique({ where: { code }, select: { status: true, guestId: true, ownerId: true, wager: true, owner: { select: { firstName: true, lastName: true } } } });
  if (!room) throw new BattleshipError("ROOM_NOT_FOUND");
  if (room.status !== "WAITING" || room.guestId) throw new BattleshipError("ROOM_NOT_JOINABLE");
  if (room.ownerId === studentId) throw new BattleshipError("OWN_ROOM");
  return { code, wager: room.wager, ownerName: `${room.owner.firstName} ${room.owner.lastName}`, settlement: battleshipSettlement(room.wager) };
}

async function settleMatch(tx: Tx, room: RoomGraph, winnerId: string, loserId: string, reason: "ALL_SHIPS_SUNK" | "FORFEIT") {
  const settlement = battleshipSettlement(room.wager);
  await lockStudents(tx, [winnerId, loserId]);
  await tx.user.update({ where: { id: winnerId }, data: { devCoins: { increment: settlement.winnerPayout } } });
  await tx.devCoinEntry.create({ data: { studentId: winnerId, delta: settlement.winnerPayout, reason: `Prêmio da Batalha Naval — sala ${room.code}`, source: "BATTLESHIP_PRIZE", idempotencyKey: `battleship:${room.id}:prize:${winnerId}` } });
  await creditTreasury(tx, settlement.taxAmount, { reason: `Taxa de 20% da Batalha Naval ${room.code}`, source: "BATTLESHIP_MATCH_TAX", idempotencyKey: `battleship:${room.id}:tax` });
  const finishedAt = new Date();
  await tx.battleshipRoom.update({ where: { id: room.id }, data: { status: "FINISHED", currentTurnId: null, escrowBalance: 0, winnerId, loserId, winnerPayout: settlement.winnerPayout, taxAmount: settlement.taxAmount, finishedAt } });
  await tx.auditLog.create({ data: { actorId: winnerId, targetId: loserId, event: "BATTLESHIP_MATCH_FINISHED", details: { roomId: room.id, code: room.code, winnerId, loserId, reason, winnerPayout: settlement.winnerPayout, taxAmount: settlement.taxAmount } } });
}

export async function fireBattleshipShot(tx: Tx, studentId: string, roomId: string, cell: number, actionKey: string) {
  await assertGamesEnabled(tx);
  await lockRoom(tx, roomId);
  let room = await getRoom(tx, roomId);
  const replay = room.shots.find((shot) => shot.actionKey === actionKey);
  if (replay) {
    if (replay.attackerId !== studentId) throw new BattleshipError("INVALID_ACTION_KEY");
    return room;
  }
  if (room.status !== "ACTIVE") throw new BattleshipError("ROOM_NOT_ACTIVE");
  if (room.currentTurnId !== studentId) throw new BattleshipError("NOT_YOUR_TURN");
  const defenderId = room.ownerId === studentId ? room.guestId : room.guestId === studentId ? room.ownerId : null;
  if (!defenderId) throw new BattleshipError("NOT_A_PLAYER");
  if (!Number.isInteger(cell) || cell < 0 || cell > 99) throw new BattleshipError("INVALID_CELL");
  if (room.shots.some((shot) => shot.attackerId === studentId && shot.cell === cell)) throw new BattleshipError("CELL_ALREADY_TARGETED");
  const board = room.boards.find((item) => item.studentId === defenderId);
  if (!board) throw new BattleshipError("BOARD_NOT_FOUND");
  const result = fireAtFleet(board.ships, cell);
  const sequence = room.shotSequence + 1;
  await lockStudents(tx, [studentId, defenderId]);
  await tx.battleshipBoard.update({ where: { id: board.id }, data: { ships: result.fleet as unknown as Prisma.InputJsonValue } });
  await tx.battleshipShot.create({ data: { roomId, attackerId: studentId, defenderId, actionKey, sequence, cell, hit: result.hit, sunkShip: result.sunkShip?.id } });
  await tx.battleshipRoom.update({ where: { id: roomId }, data: { shotSequence: sequence } });
  if (result.hit) {
    await tx.user.update({ where: { id: defenderId }, data: { xp: { decrement: BATTLESHIP_HIT_XP_PENALTY } } });
    await tx.xpEntry.create({ data: { studentId: defenderId, authorId: studentId, delta: -BATTLESHIP_HIT_XP_PENALTY, reason: `Acerto sofrido na Batalha Naval — sala ${room.code}`, source: "BATTLESHIP", idempotencyKey: `battleship:${room.id}:shot:${sequence}:hit` } });
  }
  if (result.sunkShip) {
    await tx.user.update({ where: { id: studentId }, data: { xp: { increment: BATTLESHIP_SINK_XP_REWARD } } });
    await tx.user.update({ where: { id: defenderId }, data: { xp: { decrement: BATTLESHIP_SINK_XP_PENALTY } } });
    await tx.xpEntry.createMany({ data: [
      { studentId, authorId: studentId, delta: BATTLESHIP_SINK_XP_REWARD, reason: `${result.sunkShip.label} afundado na Batalha Naval — sala ${room.code}`, source: "BATTLESHIP", idempotencyKey: `battleship:${room.id}:shot:${sequence}:sink:reward` },
      { studentId: defenderId, authorId: studentId, delta: -BATTLESHIP_SINK_XP_PENALTY, reason: `${result.sunkShip.label} perdido na Batalha Naval — sala ${room.code}`, source: "BATTLESHIP", idempotencyKey: `battleship:${room.id}:shot:${sequence}:sink:penalty` },
    ] });
  }
  await tx.auditLog.create({ data: { actorId: studentId, targetId: defenderId, event: "BATTLESHIP_SHOT_FIRED", details: { roomId, sequence, cell, hit: result.hit, sunkShip: result.sunkShip?.id ?? null } } });
  room = await getRoom(tx, roomId);
  if (result.allSunk) await settleMatch(tx, room, studentId, defenderId, "ALL_SHIPS_SUNK");
  else await tx.battleshipRoom.update({ where: { id: roomId }, data: { currentTurnId: defenderId } });
  return getRoom(tx, roomId);
}

export async function cancelBattleshipRoom(tx: Tx, studentId: string, roomId: string) {
  await lockRoom(tx, roomId);
  const room = await getRoom(tx, roomId);
  if (room.ownerId !== studentId) throw new BattleshipError("ONLY_OWNER");
  if (room.status !== "WAITING") throw new BattleshipError("ROOM_ALREADY_STARTED");
  const updated = await tx.battleshipRoom.update({ where: { id: room.id }, data: { status: "CANCELLED", cancelledAt: new Date() }, include: roomGraph });
  await tx.auditLog.create({ data: { actorId: studentId, targetId: studentId, event: "BATTLESHIP_ROOM_CANCELLED", details: { roomId, code: room.code } } });
  return updated;
}

export async function forfeitBattleshipRoom(tx: Tx, studentId: string, roomId: string) {
  await lockRoom(tx, roomId);
  const room = await getRoom(tx, roomId);
  if (room.status !== "ACTIVE") throw new BattleshipError("ROOM_NOT_ACTIVE");
  const winnerId = room.ownerId === studentId ? room.guestId : room.guestId === studentId ? room.ownerId : null;
  if (!winnerId) throw new BattleshipError("NOT_A_PLAYER");
  await settleMatch(tx, room, winnerId, studentId, "FORFEIT");
  return getRoom(tx, roomId);
}

export async function getBattleshipRoom(studentId: string, roomId: string) {
  const room = await prisma.battleshipRoom.findUnique({ where: { id: roomId }, include: roomGraph });
  if (!room) throw new BattleshipError("ROOM_NOT_FOUND");
  return battleshipRoomDto(room, studentId);
}

export async function getBattleshipLobby(studentId: string) {
  const settings = await prisma.appSetting.upsert({ where: { id: 1 }, create: { id: 1 }, update: {}, select: { gamesEnabled: true, timeZone: true } });
  const day = getSchoolDay(new Date(), settings.timeZone);
  const [currentRoom, student, matchesToday] = await Promise.all([
    prisma.battleshipRoom.findFirst({ where: { status: { in: ["WAITING", "ACTIVE"] }, OR: [{ ownerId: studentId }, { guestId: studentId }] }, select: { id: true, code: true, status: true } }),
    prisma.user.findUniqueOrThrow({ where: { id: studentId }, select: { devCoins: true } }),
    prisma.battleshipRoom.count({ where: { startedAt: { gte: day.start, lt: day.end }, OR: [{ ownerId: studentId }, { guestId: studentId }] } }),
  ]);
  return { gamesEnabled: settings.gamesEnabled, currentRoom, devCoins: student.devCoins, matchesToday, dailyLimit: BATTLESHIP_DAILY_MATCH_LIMIT };
}
