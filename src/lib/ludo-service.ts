import { randomInt } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import {
  applyLudoMove,
  chooseAutomaticPiece,
  chooseProfessorBotPiece,
  LUDO_BOT_WAGER,
  LUDO_COLORS,
  LUDO_CREATOR_START_XP_FEE,
  LUDO_DISCONNECT_GRACE_MS,
  LUDO_FINISH,
  LUDO_FORFEIT_XP_FEE,
  LUDO_INVITE_BATCH_SIZE,
  LUDO_INVITE_BATCH_XP_FEE,
  LUDO_ROOM_FEE,
  LUDO_TURN_SECONDS,
  ludoPayouts,
  ludoPlacementXp,
  parsePieces,
  rollFair,
  rollForProfessorBot,
  validPieceIndexesForPlayer,
  type LudoColor,
  type LudoRulePlayer,
} from "@/lib/ludo-rules";
import { creditTreasury, debitTreasury } from "@/lib/treasury";

type Tx = Prisma.TransactionClient;

export class LudoError extends Error {}

const roomGraph = {
  owner: { select: { id: true, firstName: true, lastName: true } },
  players: {
    orderBy: { seat: "asc" as const },
    include: { student: { select: { id: true, firstName: true, lastName: true, profileAvatar: true, xp: true, devCoins: true } } },
  },
  moves: { orderBy: { sequence: "desc" as const }, take: 12 },
} satisfies Prisma.LudoRoomInclude;

export function makeLudoRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[randomInt(0, alphabet.length)]).join("");
}

async function lockRoom(tx: Tx, roomId: string) {
  await tx.$queryRaw`SELECT "id" FROM "LudoRoom" WHERE "id" = ${roomId}::uuid FOR UPDATE`;
}

async function roomWithGraph(tx: Tx, roomId: string) {
  return tx.ludoRoom.findUniqueOrThrow({ where: { id: roomId }, include: roomGraph });
}

function deadline(seconds = LUDO_TURN_SECONDS) {
  return new Date(Date.now() + seconds * 1000);
}

function rulePlayers(players: Array<{ id: string; color: LudoColor; pieces: Prisma.JsonValue }>): LudoRulePlayer[] {
  return players.map(player => ({ id: player.id, color: player.color, pieces: parsePieces(player.pieces) }));
}

function nextBestPosition(players: Array<{ finishPosition: number | null }>, total: number) {
  const used = new Set(players.flatMap(player => player.finishPosition ?? []));
  for (let position = 1; position <= total; position += 1) if (!used.has(position)) return position;
  throw new LudoError("NO_FINISH_POSITION");
}

function nextWorstPosition(players: Array<{ finishPosition: number | null }>, total: number) {
  const used = new Set(players.flatMap(player => player.finishPosition ?? []));
  for (let position = total; position >= 1; position -= 1) if (!used.has(position)) return position;
  throw new LudoError("NO_FINISH_POSITION");
}

function nextPlayingSeat(players: Array<{ seat: number; status: string; finishPosition: number | null }>, currentSeat: number) {
  const active = players.filter(player => player.status === "PLAYING" && player.finishPosition === null).map(player => player.seat).sort((a, b) => a - b);
  if (!active.length) return null;
  return active.find(seat => seat > currentSeat) ?? active[0];
}

export async function createLudoRoom(tx: Tx, studentId: string, mode: "HUMAN" | "BOT", requestedWager: number, requestId: string, code = makeLudoRoomCode()) {
  const wager = mode === "BOT" ? LUDO_BOT_WAGER : requestedWager;
  if (!Number.isInteger(wager) || wager < 10 || wager > 100) throw new LudoError("INVALID_WAGER");
  const creationKey = `ludo-create:${studentId}:${requestId}`;
  const replay = await tx.ludoRoom.findUnique({ where: { creationKey }, include: roomGraph });
  if (replay) return { room: replay, replayed: true };

  const existing = await tx.ludoPlayer.findFirst({ where: { studentId, room: { status: { in: ["WAITING", "ACTIVE", "PAUSED"] } } }, select: { room: { select: { code: true } } } });
  if (existing) throw new LudoError(`ACTIVE_ROOM:${existing.room.code}`);

  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${studentId}::uuid FOR UPDATE`;
  const totalDebit = LUDO_ROOM_FEE + wager;
  const debit = await tx.user.updateMany({ where: { id: studentId, role: "STUDENT", status: "ACTIVE", devCoins: { gte: totalDebit } }, data: { devCoins: { decrement: totalDebit } } });
  if (debit.count !== 1) throw new LudoError("INSUFFICIENT_DEV_COINS");

  const room = await tx.ludoRoom.create({
    data: {
      code,
      creationKey,
      ownerId: studentId,
      mode,
      wager,
      roomFee: LUDO_ROOM_FEE,
      maxPlayers: mode === "BOT" ? 2 : 4,
      botAdvantaged: mode === "BOT" ? randomInt(0, 100) < 80 : null,
      escrowBalance: wager,
      players: { create: { studentId, kind: "STUDENT", color: "RED", seat: 0, stake: wager } },
    },
  });
  const feeEntry = await tx.devCoinEntry.create({ data: { studentId, authorId: studentId, delta: -LUDO_ROOM_FEE, reason: `Abertura da sala Ludo Maker ${code}`, source: "LUDO_ROOM_FEE", idempotencyKey: `${creationKey}:fee` } });
  await tx.devCoinEntry.create({ data: { studentId, authorId: studentId, delta: -wager, reason: `Aposta bloqueada na sala Ludo Maker ${code}`, source: "LUDO_ESCROW", idempotencyKey: `${creationKey}:stake` } });
  await creditTreasury(tx, LUDO_ROOM_FEE, { reason: `Taxa de abertura da sala Ludo Maker ${code}`, source: "LUDO_ROOM_FEE", idempotencyKey: `${creationKey}:treasury-fee`, devCoinEntryId: feeEntry.id });

  if (mode === "BOT") {
    await debitTreasury(tx, wager, { reason: `Aposta da IA na sala Ludo Maker ${code}`, source: "LUDO_SETTLEMENT", idempotencyKey: `${creationKey}:bot-stake` });
    await tx.ludoRoom.update({ where: { id: room.id }, data: { escrowBalance: { increment: wager }, players: { create: { kind: "BOT", color: "GREEN", seat: 1, stake: wager, connected: true } } } });
  }
  await tx.auditLog.create({ data: { actorId: studentId, targetId: studentId, event: "LUDO_ROOM_CREATED", details: { roomId: room.id, code, mode, wager, roomFee: LUDO_ROOM_FEE } } });
  return { room: await roomWithGraph(tx, room.id), replayed: false };
}

export async function joinLudoRoom(tx: Tx, studentId: string, roomId: string) {
  await lockRoom(tx, roomId);
  const room = await roomWithGraph(tx, roomId);
  if (room.status !== "WAITING" || room.mode !== "HUMAN") throw new LudoError("ROOM_NOT_JOINABLE");
  const existing = room.players.find(player => player.studentId === studentId);
  if (existing) return { room, replayed: true };
  if (room.players.length >= room.maxPlayers) throw new LudoError("ROOM_FULL");
  const otherRoom = await tx.ludoPlayer.findFirst({ where: { studentId, room: { id: { not: roomId }, status: { in: ["WAITING", "ACTIVE", "PAUSED"] } } }, select: { id: true } });
  if (otherRoom) throw new LudoError("ALREADY_IN_ANOTHER_ROOM");
  const debit = await tx.user.updateMany({ where: { id: studentId, role: "STUDENT", status: "ACTIVE", devCoins: { gte: room.wager } }, data: { devCoins: { decrement: room.wager } } });
  if (debit.count !== 1) throw new LudoError("INSUFFICIENT_DEV_COINS");
  const usedSeats = new Set(room.players.map(player => player.seat));
  const seat = [0, 1, 2, 3].find(value => !usedSeats.has(value));
  if (seat === undefined) throw new LudoError("ROOM_FULL");
  await tx.devCoinEntry.create({ data: { studentId, authorId: studentId, delta: -room.wager, reason: `Aposta bloqueada na sala Ludo Maker ${room.code}`, source: "LUDO_ESCROW", idempotencyKey: `ludo:${room.id}:stake:${studentId}` } });
  await tx.ludoPlayer.create({ data: { roomId, studentId, kind: "STUDENT", color: LUDO_COLORS[seat], seat, stake: room.wager } });
  await tx.ludoRoom.update({ where: { id: roomId }, data: { escrowBalance: { increment: room.wager }, version: { increment: 1 } } });
  await tx.ludoInvitation.updateMany({ where: { roomId, inviteeId: studentId, status: "PENDING" }, data: { status: "ACCEPTED", respondedAt: new Date() } });
  await tx.auditLog.create({ data: { actorId: studentId, targetId: room.ownerId, event: "LUDO_ROOM_JOINED", details: { roomId, code: room.code, wager: room.wager, seat } } });
  return { room: await roomWithGraph(tx, roomId), replayed: false };
}

export async function cancelLudoRoom(tx: Tx, studentId: string, roomId: string) {
  await lockRoom(tx, roomId);
  const room = await roomWithGraph(tx, roomId);
  if (room.ownerId !== studentId) throw new LudoError("ONLY_OWNER");
  if (room.status !== "WAITING") throw new LudoError("ROOM_ALREADY_STARTED");
  for (const player of room.players) {
    if (!player.studentId) continue;
    await tx.user.update({ where: { id: player.studentId }, data: { devCoins: { increment: player.stake } } });
    await tx.devCoinEntry.create({ data: { studentId: player.studentId, authorId: studentId, delta: player.stake, reason: `Devolução da aposta da sala cancelada ${room.code}`, source: "LUDO_ESCROW", idempotencyKey: `ludo:${room.id}:refund:${player.studentId}` } });
  }
  const botStake = room.players.find(player => player.kind === "BOT")?.stake ?? 0;
  if (botStake) await creditTreasury(tx, botStake, { reason: `Devolução da aposta da IA: sala ${room.code}`, source: "LUDO_SETTLEMENT", idempotencyKey: `ludo:${room.id}:bot-refund` });
  await tx.ludoInvitation.updateMany({ where: { roomId, status: "PENDING" }, data: { status: "EXPIRED", respondedAt: new Date() } });
  return tx.ludoRoom.update({ where: { id: roomId }, data: { status: "CANCELLED", cancelledAt: new Date(), escrowBalance: 0, turnDeadline: null, version: { increment: 1 } }, include: roomGraph });
}

export async function leaveWaitingLudoRoom(tx: Tx, studentId: string, roomId: string) {
  await lockRoom(tx, roomId);
  const room = await roomWithGraph(tx, roomId);
  if (room.status !== "WAITING") throw new LudoError("ROOM_ALREADY_STARTED");
  if (room.ownerId === studentId) return cancelLudoRoom(tx, studentId, roomId);
  const player = room.players.find(item => item.studentId === studentId);
  if (!player) throw new LudoError("NOT_A_PLAYER");
  await tx.user.update({ where: { id: studentId }, data: { devCoins: { increment: player.stake } } });
  await tx.devCoinEntry.create({ data: { studentId, authorId: studentId, delta: player.stake, reason: `Devolução da aposta ao sair da sala ${room.code}`, source: "LUDO_ESCROW", idempotencyKey: `ludo:${room.id}:leave-refund:${studentId}` } });
  await tx.ludoPlayer.delete({ where: { id: player.id } });
  await tx.ludoRoom.update({ where: { id: roomId }, data: { escrowBalance: { decrement: player.stake }, version: { increment: 1 } } });
  return roomWithGraph(tx, roomId);
}

export async function startLudoRoom(tx: Tx, studentId: string, roomId: string) {
  await lockRoom(tx, roomId);
  const room = await roomWithGraph(tx, roomId);
  if (room.ownerId !== studentId) throw new LudoError("ONLY_OWNER");
  if (room.status !== "WAITING") throw new LudoError("ROOM_ALREADY_STARTED");
  if (room.players.length < 2) throw new LudoError("NOT_ENOUGH_PLAYERS");
  await tx.user.update({ where: { id: studentId }, data: { xp: { decrement: LUDO_CREATOR_START_XP_FEE } } });
  await tx.xpEntry.create({ data: { studentId, authorId: studentId, delta: -LUDO_CREATOR_START_XP_FEE, reason: `Início da sala Ludo Maker ${room.code}`, source: "LUDO_ROOM", idempotencyKey: `ludo:${room.id}:creator-start` } });
  await tx.ludoPlayer.updateMany({ where: { roomId }, data: { status: "PLAYING" } });
  await tx.ludoRoom.update({ where: { id: roomId }, data: { status: "ACTIVE", initialPlayerCount: room.players.length, currentSeat: 0, currentRoll: null, consecutiveSixes: 0, pauseRequestCount: 0, startedAt: new Date(), turnDeadline: deadline(), version: { increment: 1 } } });
  await tx.auditLog.create({ data: { actorId: studentId, targetId: studentId, event: "LUDO_MATCH_STARTED", details: { roomId, code: room.code, players: room.players.length, wager: room.wager, escrow: room.escrowBalance } } });
  return roomWithGraph(tx, roomId);
}

async function settleLudoRoom(tx: Tx, roomId: string) {
  const room = await roomWithGraph(tx, roomId);
  if (room.status === "FINISHED") return room;
  if (!room.initialPlayerCount || room.players.some(player => player.finishPosition === null)) return room;
  const split = ludoPayouts(room.escrowBalance, room.initialPlayerCount);
  const payouts = new Map<number, number>([[1, split.first], [2, split.second]]);
  let treasuryAmount = split.treasury;

  for (const player of room.players) {
    const payout = payouts.get(player.finishPosition ?? 0) ?? 0;
    if (player.kind === "BOT") {
      treasuryAmount += payout;
    } else if (player.studentId && payout > 0) {
      await tx.user.update({ where: { id: player.studentId }, data: { devCoins: { increment: payout } } });
      await tx.devCoinEntry.create({ data: { studentId: player.studentId, delta: payout, reason: `${player.finishPosition}º lugar no Ludo Maker — sala ${room.code}`, source: "LUDO_PRIZE", idempotencyKey: `ludo:${room.id}:payout:${player.studentId}` } });
    }
    if (player.studentId && player.finishPosition) {
      const xpDelta = ludoPlacementXp(player.finishPosition, room.initialPlayerCount);
      if (xpDelta !== 0) {
        await tx.user.update({ where: { id: player.studentId }, data: { xp: { increment: xpDelta } } });
        await tx.xpEntry.create({ data: { studentId: player.studentId, delta: xpDelta, reason: `${player.finishPosition}º lugar no Ludo Maker — sala ${room.code}`, source: "LUDO_RESULT", idempotencyKey: `ludo:${room.id}:result-xp:${player.studentId}` } });
      }
    }
    await tx.ludoPlayer.update({ where: { id: player.id }, data: { payout } });
  }
  if (treasuryAmount > 0) await creditTreasury(tx, treasuryAmount, { reason: `Parcela do sistema na sala Ludo Maker ${room.code}`, source: "LUDO_SETTLEMENT", idempotencyKey: `ludo:${room.id}:treasury-settlement` });
  await tx.ludoRoom.update({ where: { id: room.id }, data: { status: "FINISHED", escrowBalance: 0, currentRoll: null, turnDeadline: null, finishedAt: new Date(), version: { increment: 1 } } });
  await tx.auditLog.create({ data: { actorId: room.ownerId, targetId: room.ownerId, event: "LUDO_MATCH_FINISHED", details: { roomId: room.id, code: room.code, split, treasuryAmount, placements: room.players.map(player => ({ playerId: player.id, studentId: player.studentId, position: player.finishPosition })) } } });
  return roomWithGraph(tx, roomId);
}

async function completeLastPlayerIfNeeded(tx: Tx, roomId: string) {
  const room = await roomWithGraph(tx, roomId);
  const playing = room.players.filter(player => player.status === "PLAYING" && player.finishPosition === null);
  if (playing.length === 1 && room.initialPlayerCount) {
    const position = nextBestPosition(room.players, room.initialPlayerCount);
    await tx.ludoPlayer.update({ where: { id: playing[0].id }, data: { status: "FINISHED", finishPosition: position, finishedAt: new Date(), pieces: [LUDO_FINISH, LUDO_FINISH, LUDO_FINISH, LUDO_FINISH] } });
  }
  return settleLudoRoom(tx, roomId);
}

async function performRoll(tx: Tx, roomId: string, studentId: string | null, automatic: boolean, random = Math.random) {
  await lockRoom(tx, roomId);
  const room = await roomWithGraph(tx, roomId);
  if (room.status !== "ACTIVE") throw new LudoError("ROOM_NOT_ACTIVE");
  if (room.currentRoll !== null) throw new LudoError("ROLL_ALREADY_EXISTS");
  const player = room.players.find(item => item.seat === room.currentSeat && item.status === "PLAYING");
  if (!player) throw new LudoError("TURN_PLAYER_NOT_FOUND");
  if (studentId && player.studentId !== studentId) throw new LudoError("NOT_YOUR_TURN");
  const players = rulePlayers(room.players);
  const roll = player.kind === "BOT" ? rollForProfessorBot(players, player.id, random, room.botAdvantaged !== false) : rollFair(random);
  const consecutiveSixes = roll === 6 ? room.consecutiveSixes + 1 : 0;
  const sequence = room.version + 1;
  await tx.ludoMove.create({ data: { roomId, playerId: player.id, sequence, kind: automatic ? "AUTO_ROLL" : "ROLL", roll, autoReason: automatic ? (player.kind === "BOT" ? "PROFESSOR_BOT" : "TIMEOUT") : null } });

  if (consecutiveSixes >= 3) {
    const nextSeat = nextPlayingSeat(room.players, player.seat);
    await tx.ludoRoom.update({ where: { id: roomId }, data: { currentSeat: nextSeat ?? player.seat, currentRoll: null, consecutiveSixes: 0, turnDeadline: deadline(), version: sequence } });
    return { room: await roomWithGraph(tx, roomId), roll, needsMove: false };
  }
  const valid = validPieceIndexesForPlayer(players, player.id, roll);
  if (!valid.length) {
    const nextSeat = roll === 6 ? player.seat : nextPlayingSeat(room.players, player.seat);
    await tx.ludoRoom.update({ where: { id: roomId }, data: { currentSeat: nextSeat ?? player.seat, currentRoll: null, consecutiveSixes, turnDeadline: player.kind === "BOT" ? new Date() : deadline(), version: sequence } });
    return { room: await roomWithGraph(tx, roomId), roll, needsMove: false };
  }
  await tx.ludoRoom.update({ where: { id: roomId }, data: { currentRoll: roll, consecutiveSixes, turnDeadline: player.kind === "BOT" ? new Date() : deadline(), version: sequence } });
  return { room: await roomWithGraph(tx, roomId), roll, needsMove: true };
}

async function performMove(tx: Tx, roomId: string, studentId: string | null, pieceIndex: number | null, automatic: boolean, random = Math.random) {
  await lockRoom(tx, roomId);
  const room = await roomWithGraph(tx, roomId);
  if (room.status !== "ACTIVE" || room.currentRoll === null) throw new LudoError("MOVE_NOT_AVAILABLE");
  const player = room.players.find(item => item.seat === room.currentSeat && item.status === "PLAYING");
  if (!player) throw new LudoError("TURN_PLAYER_NOT_FOUND");
  if (studentId && player.studentId !== studentId) throw new LudoError("NOT_YOUR_TURN");
  const players = rulePlayers(room.players);
  const selected = pieceIndex ?? (player.kind === "BOT" ? chooseProfessorBotPiece(players, player.id, room.currentRoll) : chooseAutomaticPiece(players, player.id, room.currentRoll, random));
  if (selected === null) throw new LudoError("NO_VALID_MOVE");
  const result = applyLudoMove(players, player.id, selected, room.currentRoll);
  const changed = new Map(players.map(item => [item.id, item.pieces]));
  for (const roomPlayer of room.players) {
    const pieces = changed.get(roomPlayer.id);
    if (pieces) await tx.ludoPlayer.update({ where: { id: roomPlayer.id }, data: { pieces } });
  }

  let finishedPosition: number | null = null;
  if (result.finished && room.initialPlayerCount) {
    finishedPosition = nextBestPosition(room.players, room.initialPlayerCount);
    await tx.ludoPlayer.update({ where: { id: player.id }, data: { status: "FINISHED", finishPosition: finishedPosition, finishedAt: new Date() } });
  }
  const playersAfter = room.players.map(item => item.id === player.id && finishedPosition ? { ...item, status: "FINISHED", finishPosition: finishedPosition } : item);
  const nextSeat = !finishedPosition && result.extraTurn ? player.seat : nextPlayingSeat(playersAfter, player.seat);
  const sequence = room.version + 1;
  await tx.ludoMove.create({ data: { roomId, playerId: player.id, capturedPlayerId: result.captured[0]?.playerId, sequence, kind: automatic ? "AUTO_MOVE" : "MOVE", roll: room.currentRoll, pieceIndex: selected, fromPosition: result.from, toPosition: result.to, captured: result.captured, autoReason: automatic ? (player.kind === "BOT" ? "PROFESSOR_BOT" : "TIMEOUT") : null } });
  await tx.ludoRoom.update({ where: { id: roomId }, data: { currentSeat: nextSeat ?? player.seat, currentRoll: null, turnDeadline: nextSeat === null ? null : (room.players.find(item => item.seat === nextSeat)?.kind === "BOT" ? new Date() : deadline()), version: sequence } });
  await completeLastPlayerIfNeeded(tx, roomId);
  return roomWithGraph(tx, roomId);
}

export async function rollLudoTurn(tx: Tx, studentId: string, roomId: string) {
  return performRoll(tx, roomId, studentId, false);
}

export async function moveLudoPiece(tx: Tx, studentId: string, roomId: string, pieceIndex: number) {
  return performMove(tx, roomId, studentId, pieceIndex, false);
}

export async function forfeitLudoPlayer(tx: Tx, studentId: string, roomId: string, reason: "QUIT" | "DISCONNECTED") {
  await lockRoom(tx, roomId);
  const room = await roomWithGraph(tx, roomId);
  if (room.status !== "ACTIVE") throw new LudoError("ROOM_NOT_ACTIVE");
  const player = room.players.find(item => item.studentId === studentId && item.status === "PLAYING");
  if (!player || !room.initialPlayerCount) throw new LudoError("NOT_AN_ACTIVE_PLAYER");
  const position = nextWorstPosition(room.players, room.initialPlayerCount);
  await tx.user.update({ where: { id: studentId }, data: { xp: { decrement: LUDO_FORFEIT_XP_FEE } } });
  await tx.xpEntry.create({ data: { studentId, delta: -LUDO_FORFEIT_XP_FEE, reason: `${reason === "DISCONNECTED" ? "Desconexão superior a 3 minutos" : "Desistência"} no Ludo Maker — sala ${room.code}`, source: "LUDO_FORFEIT", idempotencyKey: `ludo:${room.id}:forfeit:${studentId}` } });
  await tx.ludoPlayer.update({ where: { id: player.id }, data: { status: "FORFEITED", finishPosition: position, forfeitedAt: new Date(), connected: false } });
  const nextOwner = room.ownerId === studentId ? room.players.find(item => item.studentId && item.studentId !== studentId && item.status === "PLAYING")?.studentId : null;
  const nextSeat = player.seat === room.currentSeat ? nextPlayingSeat(room.players.map(item => item.id === player.id ? { ...item, status: "FORFEITED", finishPosition: position } : item), player.seat) : room.currentSeat;
  await tx.ludoMove.create({ data: { roomId, playerId: player.id, sequence: room.version + 1, kind: "FORFEIT", autoReason: reason } });
  await tx.ludoRoom.update({ where: { id: roomId }, data: { ...(nextOwner ? { ownerId: nextOwner } : {}), currentSeat: nextSeat ?? room.currentSeat, currentRoll: player.seat === room.currentSeat ? null : room.currentRoll, turnDeadline: deadline(), version: { increment: 1 } } });
  await tx.auditLog.create({ data: { actorId: studentId, targetId: studentId, event: "LUDO_PLAYER_FORFEITED", details: { roomId, code: room.code, reason, position, xp: -LUDO_FORFEIT_XP_FEE } } });
  return completeLastPlayerIfNeeded(tx, roomId);
}

export async function pauseOrRequestLudoRoom(tx: Tx, studentId: string, roomId: string) {
  await lockRoom(tx, roomId);
  const room = await roomWithGraph(tx, roomId);
  if (room.status !== "ACTIVE") throw new LudoError("ROOM_NOT_ACTIVE");
  if (!room.players.some(player => player.studentId === studentId && player.status === "PLAYING")) throw new LudoError("NOT_AN_ACTIVE_PLAYER");
  const direct = room.ownerId === studentId;
  const requestCount = direct ? room.pauseRequestCount : room.pauseRequestCount + 1;
  const automatic = !direct && room.initialPlayerCount === 2 && requestCount >= 3;
  if (direct || automatic) {
    await tx.ludoRoom.update({ where: { id: roomId }, data: { status: "PAUSED", pausedAt: new Date(), turnDeadline: null, pauseRequestCount: 0, version: { increment: 1 } } });
    await tx.auditLog.create({ data: { actorId: studentId, targetId: room.ownerId, event: "LUDO_MATCH_PAUSED", details: { roomId, code: room.code, automatic, requests: requestCount } } });
    return { room: await roomWithGraph(tx, roomId), paused: true, requestCount: automatic ? 0 : requestCount };
  }
  await tx.ludoRoom.update({ where: { id: roomId }, data: { pauseRequestCount: requestCount, version: { increment: 1 } } });
  return { room: await roomWithGraph(tx, roomId), paused: false, requestCount };
}

export async function resumeLudoRoom(tx: Tx, studentId: string, roomId: string) {
  await lockRoom(tx, roomId);
  const room = await roomWithGraph(tx, roomId);
  if (room.ownerId !== studentId) throw new LudoError("ONLY_OWNER");
  if (room.status !== "PAUSED") throw new LudoError("ROOM_NOT_PAUSED");
  await tx.ludoRoom.update({ where: { id: roomId }, data: { status: "ACTIVE", pausedAt: null, turnDeadline: deadline(), version: { increment: 1 } } });
  return roomWithGraph(tx, roomId);
}

export async function inviteLudoStudent(tx: Tx, inviterId: string, roomId: string, inviteeId: string) {
  await lockRoom(tx, roomId);
  const room = await roomWithGraph(tx, roomId);
  if (room.ownerId !== inviterId) throw new LudoError("ONLY_OWNER");
  if (room.status !== "WAITING" || room.mode !== "HUMAN") throw new LudoError("ROOM_NOT_JOINABLE");
  if (room.players.length >= room.maxPlayers) throw new LudoError("ROOM_FULL");
  if (inviterId === inviteeId) throw new LudoError("CANNOT_INVITE_SELF");
  if (room.players.some(player => player.studentId === inviteeId)) throw new LudoError("ALREADY_IN_ROOM");
  const invitee = await tx.user.findFirst({ where: { id: inviteeId, role: "STUDENT", status: "ACTIVE" }, select: { id: true, firstName: true, lastName: true, devCoins: true } });
  if (!invitee) throw new LudoError("STUDENT_UNAVAILABLE");
  const block = await tx.ludoInvitationBlock.findUnique({ where: { blockerId_blockedId: { blockerId: inviteeId, blockedId: inviterId } } });
  if (block && block.expiresAt > new Date()) throw new LudoError("INVITATIONS_BLOCKED");
  const pending = await tx.ludoInvitation.findFirst({ where: { roomId, inviteeId, status: "PENDING", expiresAt: { gt: new Date() } }, select: { id: true } });
  if (pending) throw new LudoError("INVITATION_PENDING");
  const attempts = await tx.ludoInvitation.count({ where: { roomId, inviterId, inviteeId } });
  const batch = Math.floor(attempts / LUDO_INVITE_BATCH_SIZE);
  if (attempts % LUDO_INVITE_BATCH_SIZE === 0) {
    await tx.user.update({ where: { id: inviterId }, data: { xp: { decrement: LUDO_INVITE_BATCH_XP_FEE } } });
    await tx.xpEntry.create({ data: { studentId: inviterId, authorId: inviterId, delta: -LUDO_INVITE_BATCH_XP_FEE, reason: `Pacote de 5 convites para ${invitee.firstName} ${invitee.lastName} no Ludo Maker`, source: "LUDO_INVITE", idempotencyKey: `ludo:${room.id}:invite-batch:${inviteeId}:${batch}` } });
  }
  const invitation = await tx.ludoInvitation.create({ data: { roomId, inviterId, inviteeId, expiresAt: new Date(Date.now() + 5 * 60_000) } });
  await tx.auditLog.create({ data: { actorId: inviterId, targetId: inviteeId, event: "LUDO_INVITE_SENT", details: { roomId, code: room.code, invitationId: invitation.id, attempt: attempts + 1, batch } } });
  return { invitation, room, invitee, chargedXp: attempts % LUDO_INVITE_BATCH_SIZE === 0 ? LUDO_INVITE_BATCH_XP_FEE : 0, remainingInBatch: LUDO_INVITE_BATCH_SIZE - ((attempts + 1) % LUDO_INVITE_BATCH_SIZE || LUDO_INVITE_BATCH_SIZE) };
}

export async function respondToLudoInvitation(tx: Tx, studentId: string, invitationId: string, accept: boolean, block: boolean) {
  const invitation = await tx.ludoInvitation.findUnique({ where: { id: invitationId }, include: { room: true } });
  if (!invitation || invitation.inviteeId !== studentId || invitation.status !== "PENDING" || invitation.expiresAt <= new Date()) throw new LudoError("INVITATION_UNAVAILABLE");
  if (block) {
    await tx.ludoInvitationBlock.upsert({ where: { blockerId_blockedId: { blockerId: studentId, blockedId: invitation.inviterId } }, create: { blockerId: studentId, blockedId: invitation.inviterId, expiresAt: new Date(Date.now() + 10 * 60_000) }, update: { expiresAt: new Date(Date.now() + 10 * 60_000), createdAt: new Date() } });
  }
  if (!accept) {
    await tx.ludoInvitation.update({ where: { id: invitation.id }, data: { status: "DECLINED", respondedAt: new Date() } });
    return { accepted: false, room: invitation.room };
  }
  const joined = await joinLudoRoom(tx, studentId, invitation.roomId);
  return { accepted: true, room: joined.room };
}

export async function tickLudoRoom(tx: Tx, roomId: string, random = Math.random) {
  for (let step = 0; step < 12; step += 1) {
    await lockRoom(tx, roomId);
    let room = await roomWithGraph(tx, roomId);
    if (room.status !== "ACTIVE") return room;
    const expired = room.players.find(player => player.studentId && player.status === "PLAYING" && player.disconnectedAt && player.disconnectedAt.getTime() <= Date.now() - LUDO_DISCONNECT_GRACE_MS);
    if (expired?.studentId) {
      await forfeitLudoPlayer(tx, expired.studentId, roomId, "DISCONNECTED");
      continue;
    }
    if (!room.turnDeadline || room.turnDeadline > new Date()) return room;
    const current = room.players.find(player => player.seat === room.currentSeat && player.status === "PLAYING");
    if (!current) return room;
    if (room.currentRoll === null) await performRoll(tx, roomId, null, true, random);
    else await performMove(tx, roomId, null, null, true, random);
    room = await roomWithGraph(tx, roomId);
    const next = room.players.find(player => player.seat === room.currentSeat);
    if (next?.kind !== "BOT" && room.turnDeadline && room.turnDeadline > new Date()) return room;
  }
  return roomWithGraph(tx, roomId);
}

export async function getLudoRoom(tx: Tx, studentId: string, roomId: string) {
  const room = await roomWithGraph(tx, roomId);
  if (!room.players.some(player => player.studentId === studentId)) throw new LudoError("NOT_A_PLAYER");
  return room;
}

export async function getLudoRoomByCode(tx: Tx, code: string) {
  const room = await tx.ludoRoom.findUnique({ where: { code: code.toUpperCase() }, select: { id: true } });
  if (!room) throw new LudoError("ROOM_NOT_FOUND");
  return room;
}
