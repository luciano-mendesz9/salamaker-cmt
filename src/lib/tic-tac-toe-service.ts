import { randomInt } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { creditTreasury } from "@/lib/treasury";
import {
  applyTicTacToeMove,
  TIC_TAC_TOE_MAX_WAGER,
  TIC_TAC_TOE_MIN_WAGER,
  TIC_TAC_TOE_WIN_XP,
  ticTacToeSettlement,
  ticTacToeWinner,
  type TicTacToeMark,
} from "@/lib/tic-tac-toe-rules";

type Tx = Prisma.TransactionClient;
export class TicTacToeError extends Error {}

const roomGraph = {
  owner: { select: { id: true, firstName: true, lastName: true, profileAvatar: true } },
  guest: { select: { id: true, firstName: true, lastName: true, profileAvatar: true } },
} satisfies Prisma.TicTacToeRoomInclude;
type RoomGraph = Prisma.TicTacToeRoomGetPayload<{ include: typeof roomGraph }>;

export function makeTicTacToeCode() {
  return String(randomInt(100_000, 1_000_000));
}

async function assertGamesEnabled(tx: Tx) {
  const settings = await tx.appSetting.upsert({ where: { id: 1 }, create: { id: 1 }, update: {}, select: { gamesEnabled: true } });
  if (!settings.gamesEnabled) throw new TicTacToeError("GAMES_DISABLED");
}

async function lockRoom(tx: Tx, roomId: string) {
  await tx.$queryRaw`SELECT "id" FROM "TicTacToeRoom" WHERE "id" = ${roomId}::uuid FOR UPDATE`;
}

async function lockStudents(tx: Tx, ids: string[]) {
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"::text IN (${Prisma.join([...ids].sort())}) ORDER BY "id" FOR UPDATE`;
}

async function getRoom(tx: Tx, roomId: string) {
  return tx.ticTacToeRoom.findUniqueOrThrow({ where: { id: roomId }, include: roomGraph });
}

function otherMark(mark: TicTacToeMark): TicTacToeMark {
  return mark === "X" ? "O" : "X";
}

export function ticTacToeRoomDto(room: RoomGraph, viewerId: string) {
  const isOwner = room.ownerId === viewerId;
  if (!isOwner && room.guestId !== viewerId) throw new TicTacToeError("NOT_A_PLAYER");
  const viewerMark = isOwner ? room.ownerMark : otherMark(room.ownerMark);
  const currentPlayerId = room.status === "ACTIVE"
    ? room.nextMark === room.ownerMark ? room.ownerId : room.guestId
    : null;
  return {
    id: room.id,
    code: room.code,
    status: room.status,
    wager: room.wager,
    round: room.round,
    board: room.board,
    nextMark: room.nextMark,
    ownerMark: room.ownerMark,
    viewerMark,
    currentPlayerId,
    isOwner,
    winnerId: room.winnerId,
    isDraw: room.isDraw,
    winnerPayout: room.winnerPayout,
    taxAmount: room.taxAmount,
    ownerRematchReady: room.ownerRematchReady,
    guestRematchReady: room.guestRematchReady,
    owner: room.owner,
    guest: room.guest,
    startedAt: room.startedAt?.toISOString() ?? null,
    finishedAt: room.finishedAt?.toISOString() ?? null,
    settlement: ticTacToeSettlement(room.wager),
  };
}

export async function createTicTacToeRoom(tx: Tx, studentId: string, wager: number, requestId: string, code = makeTicTacToeCode()) {
  await assertGamesEnabled(tx);
  if (!Number.isInteger(wager) || wager < TIC_TAC_TOE_MIN_WAGER || wager > TIC_TAC_TOE_MAX_WAGER) throw new TicTacToeError("INVALID_WAGER");
  const creationKey = `tic-tac-toe:create:${studentId}:${requestId}`;
  const replay = await tx.ticTacToeRoom.findUnique({ where: { creationKey }, include: roomGraph });
  if (replay) return { room: replay, replayed: true };
  await lockStudents(tx, [studentId]);
  const existing = await tx.ticTacToeRoom.findFirst({
    where: { status: { in: ["WAITING", "ACTIVE"] }, OR: [{ ownerId: studentId }, { guestId: studentId }] },
    select: { id: true, code: true },
  });
  if (existing) throw new TicTacToeError(`ACTIVE_ROOM:${existing.id}:${existing.code}`);
  const student = await tx.user.findFirst({ where: { id: studentId, role: "STUDENT", status: "ACTIVE" }, select: { devCoins: true } });
  if (!student || student.devCoins < wager) throw new TicTacToeError("INSUFFICIENT_DEV_COINS");
  const room = await tx.ticTacToeRoom.create({ data: { code, creationKey, ownerId: studentId, wager }, include: roomGraph });
  await tx.auditLog.create({ data: { actorId: studentId, targetId: studentId, event: "TIC_TAC_TOE_ROOM_CREATED", details: { roomId: room.id, code, wager } } });
  return { room, replayed: false };
}

async function debitRoundStakes(tx: Tx, room: RoomGraph, round: number) {
  if (!room.guestId) throw new TicTacToeError("NOT_ENOUGH_PLAYERS");
  const ids = [room.ownerId, room.guestId];
  await lockStudents(tx, ids);
  for (const studentId of ids) {
    const debit = await tx.user.updateMany({ where: { id: studentId, role: "STUDENT", status: "ACTIVE", devCoins: { gte: room.wager } }, data: { devCoins: { decrement: room.wager } } });
    if (debit.count !== 1) throw new TicTacToeError(studentId === room.ownerId ? "INSUFFICIENT_DEV_COINS" : "GUEST_INSUFFICIENT_DEV_COINS");
    await tx.devCoinEntry.create({
      data: { studentId, authorId: studentId, delta: -room.wager, reason: `Aposta no jogo da velha — sala ${room.code}, rodada ${round}`, source: "TIC_TAC_TOE_WAGER", idempotencyKey: `tic-tac-toe:${room.id}:round:${round}:stake:${studentId}` },
    });
  }
}

export async function joinTicTacToeRoom(tx: Tx, studentId: string, code: string) {
  await assertGamesEnabled(tx);
  const normalized = code.trim();
  if (!/^\d{6}$/.test(normalized)) throw new TicTacToeError("INVALID_CODE");
  const found = await tx.ticTacToeRoom.findUnique({ where: { code: normalized }, select: { id: true } });
  if (!found) throw new TicTacToeError("ROOM_NOT_FOUND");
  await lockRoom(tx, found.id);
  let room = await getRoom(tx, found.id);
  if (room.status !== "WAITING" || room.guestId) throw new TicTacToeError("ROOM_NOT_JOINABLE");
  if (room.ownerId === studentId) throw new TicTacToeError("OWN_ROOM");
  await lockStudents(tx, [studentId]);
  const existing = await tx.ticTacToeRoom.findFirst({ where: { status: { in: ["WAITING", "ACTIVE"] }, OR: [{ ownerId: studentId }, { guestId: studentId }] }, select: { id: true } });
  if (existing) throw new TicTacToeError("ALREADY_IN_ROOM");
  room = await tx.ticTacToeRoom.update({ where: { id: room.id }, data: { guestId: studentId }, include: roomGraph });
  await debitRoundStakes(tx, room, 1);
  const startedAt = new Date();
  room = await tx.ticTacToeRoom.update({ where: { id: room.id }, data: { status: "ACTIVE", escrowBalance: room.wager * 2, startedAt }, include: roomGraph });
  await tx.auditLog.create({ data: { actorId: studentId, targetId: room.ownerId, event: "TIC_TAC_TOE_MATCH_STARTED", details: { roomId: room.id, code: room.code, wager: room.wager, round: 1 } } });
  return room;
}

async function settleRound(tx: Tx, room: RoomGraph, board: string, winnerId: string | null, winnerMark: TicTacToeMark | null) {
  const isDraw = winnerId === null;
  const settlement = ticTacToeSettlement(room.wager);
  let winnerPayout = 0;
  let taxAmount = 0;
  if (isDraw) {
    for (const studentId of [room.ownerId, room.guestId!]) {
      await tx.user.update({ where: { id: studentId }, data: { devCoins: { increment: room.wager } } });
      await tx.devCoinEntry.create({ data: { studentId, delta: room.wager, reason: `Devolução por empate no jogo da velha — sala ${room.code}, rodada ${room.round}`, source: "TIC_TAC_TOE_PRIZE", idempotencyKey: `tic-tac-toe:${room.id}:round:${room.round}:draw:${studentId}` } });
    }
  } else {
    winnerPayout = settlement.winnerPayout;
    taxAmount = settlement.taxAmount;
    await tx.user.update({ where: { id: winnerId! }, data: { devCoins: { increment: winnerPayout }, xp: { increment: TIC_TAC_TOE_WIN_XP } } });
    await tx.devCoinEntry.create({ data: { studentId: winnerId!, delta: winnerPayout, reason: `Vitória no jogo da velha — sala ${room.code}, rodada ${room.round}`, source: "TIC_TAC_TOE_PRIZE", idempotencyKey: `tic-tac-toe:${room.id}:round:${room.round}:prize:${winnerId}` } });
    await tx.xpEntry.create({ data: { studentId: winnerId!, delta: TIC_TAC_TOE_WIN_XP, reason: `Vitória no jogo da velha — sala ${room.code}`, source: "TIC_TAC_TOE_RESULT", idempotencyKey: `tic-tac-toe:${room.id}:round:${room.round}:xp:${winnerId}` } });
    await creditTreasury(tx, taxAmount, { reason: `Imposto do jogo da velha ${room.code}, rodada ${room.round}`, source: "TIC_TAC_TOE_MATCH_TAX", idempotencyKey: `tic-tac-toe:${room.id}:round:${room.round}:tax` });
  }
  const finishedAt = new Date();
  await tx.ticTacToeRound.create({ data: { roomId: room.id, round: room.round, board, winnerId, winnerMark, isDraw, winnerPayout, taxAmount, startedAt: room.startedAt ?? finishedAt, finishedAt } });
  await tx.ticTacToeRoom.update({ where: { id: room.id }, data: { status: "FINISHED", board, escrowBalance: 0, winnerId, isDraw, winnerPayout, taxAmount, finishedAt, ownerRematchReady: false, guestRematchReady: false } });
  await tx.auditLog.create({ data: { actorId: winnerId ?? room.ownerId, targetId: winnerId ? (winnerId === room.ownerId ? room.guestId : room.ownerId) : room.guestId, event: "TIC_TAC_TOE_MATCH_FINISHED", details: { roomId: room.id, code: room.code, round: room.round, winnerId, isDraw, winnerPayout, taxAmount } } });
}

export async function playTicTacToeMove(tx: Tx, studentId: string, roomId: string, cell: number) {
  await assertGamesEnabled(tx);
  await lockRoom(tx, roomId);
  const room = await getRoom(tx, roomId);
  if (room.status !== "ACTIVE") throw new TicTacToeError("ROOM_NOT_ACTIVE");
  const playerMark = room.ownerId === studentId ? room.ownerMark : room.guestId === studentId ? otherMark(room.ownerMark) : null;
  if (!playerMark) throw new TicTacToeError("NOT_A_PLAYER");
  if (room.nextMark !== playerMark) throw new TicTacToeError("NOT_YOUR_TURN");
  let board: string;
  try { board = applyTicTacToeMove(room.board, cell, playerMark); }
  catch (error) { throw new TicTacToeError((error as Error).message); }
  const winnerMark = ticTacToeWinner(board);
  const draw = !winnerMark && !board.includes("-");
  if (winnerMark || draw) await settleRound(tx, room, board, winnerMark ? studentId : null, winnerMark);
  else await tx.ticTacToeRoom.update({ where: { id: room.id }, data: { board, nextMark: otherMark(room.nextMark) } });
  await tx.auditLog.create({ data: { actorId: studentId, targetId: room.ownerId, event: "TIC_TAC_TOE_MOVE_PLAYED", details: { roomId, round: room.round, cell, mark: playerMark } } });
  return getRoom(tx, roomId);
}

export async function requestTicTacToeRematch(tx: Tx, studentId: string, roomId: string) {
  await assertGamesEnabled(tx);
  await lockRoom(tx, roomId);
  let room = await getRoom(tx, roomId);
  if (room.status !== "FINISHED") throw new TicTacToeError("ROOM_NOT_FINISHED");
  const isOwner = room.ownerId === studentId;
  if (!isOwner && room.guestId !== studentId) throw new TicTacToeError("NOT_A_PLAYER");
  room = await tx.ticTacToeRoom.update({ where: { id: room.id }, data: isOwner ? { ownerRematchReady: true } : { guestRematchReady: true }, include: roomGraph });
  await tx.auditLog.create({ data: { actorId: studentId, targetId: isOwner ? room.guestId : room.ownerId, event: "TIC_TAC_TOE_REMATCH_REQUESTED", details: { roomId, round: room.round } } });
  if (!room.ownerRematchReady || !room.guestRematchReady) return room;
  const nextRound = room.round + 1;
  await debitRoundStakes(tx, room, nextRound);
  room = await tx.ticTacToeRoom.update({
    where: { id: room.id },
    data: { status: "ACTIVE", round: nextRound, board: "---------", nextMark: "X", ownerMark: otherMark(room.ownerMark), escrowBalance: room.wager * 2, winnerId: null, isDraw: false, winnerPayout: 0, taxAmount: 0, ownerRematchReady: false, guestRematchReady: false, startedAt: new Date(), finishedAt: null },
    include: roomGraph,
  });
  await tx.auditLog.create({ data: { actorId: studentId, targetId: isOwner ? room.guestId : room.ownerId, event: "TIC_TAC_TOE_MATCH_STARTED", details: { roomId, code: room.code, wager: room.wager, round: nextRound, rematch: true } } });
  return room;
}

export async function cancelTicTacToeRoom(tx: Tx, studentId: string, roomId: string) {
  await lockRoom(tx, roomId);
  const room = await getRoom(tx, roomId);
  if (room.ownerId !== studentId) throw new TicTacToeError("ONLY_OWNER");
  if (room.status !== "WAITING") throw new TicTacToeError("ROOM_ALREADY_STARTED");
  const updated = await tx.ticTacToeRoom.update({ where: { id: room.id }, data: { status: "CANCELLED", cancelledAt: new Date() }, include: roomGraph });
  await tx.auditLog.create({ data: { actorId: studentId, targetId: studentId, event: "TIC_TAC_TOE_ROOM_CANCELLED", details: { roomId, code: room.code } } });
  return updated;
}

export async function forfeitTicTacToeRoom(tx: Tx, studentId: string, roomId: string) {
  await lockRoom(tx, roomId);
  const room = await getRoom(tx, roomId);
  if (room.status !== "ACTIVE") throw new TicTacToeError("ROOM_NOT_ACTIVE");
  const winnerId = room.ownerId === studentId ? room.guestId : room.guestId === studentId ? room.ownerId : null;
  if (!winnerId) throw new TicTacToeError("NOT_A_PLAYER");
  const winnerMark = winnerId === room.ownerId ? room.ownerMark : otherMark(room.ownerMark);
  await settleRound(tx, room, room.board, winnerId, winnerMark);
  return getRoom(tx, roomId);
}

export async function getTicTacToeRoom(studentId: string, roomId: string) {
  const room = await prisma.ticTacToeRoom.findUnique({ where: { id: roomId }, include: roomGraph });
  if (!room) throw new TicTacToeError("ROOM_NOT_FOUND");
  return ticTacToeRoomDto(room, studentId);
}

export async function getTicTacToeLobby(studentId: string) {
  const [settings, currentRoom, student] = await Promise.all([
    prisma.appSetting.upsert({ where: { id: 1 }, create: { id: 1 }, update: {}, select: { gamesEnabled: true } }),
    prisma.ticTacToeRoom.findFirst({ where: { status: { in: ["WAITING", "ACTIVE"] }, OR: [{ ownerId: studentId }, { guestId: studentId }] }, select: { id: true, code: true, status: true } }),
    prisma.user.findUniqueOrThrow({ where: { id: studentId }, select: { devCoins: true } }),
  ]);
  return { gamesEnabled: settings.gamesEnabled, currentRoom, devCoins: student.devCoins };
}
