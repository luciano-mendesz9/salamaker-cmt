import { randomInt } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { getSchoolDay } from "@/lib/school-day";
import {
  applyTicTacToeMove,
  TIC_TAC_TOE_SOLO_FULL_XP_MATCHES,
  ticTacToeMachineMove,
  ticTacToeSoloXpAward,
  ticTacToeWinner,
} from "@/lib/tic-tac-toe-rules";
import { TicTacToeError } from "@/lib/tic-tac-toe-service";

type Tx = Prisma.TransactionClient;

async function assertGamesEnabled(tx: Tx) {
  const settings = await tx.appSetting.upsert({ where: { id: 1 }, create: { id: 1 }, update: {}, select: { gamesEnabled: true } });
  if (!settings.gamesEnabled) throw new TicTacToeError("GAMES_DISABLED");
}

async function lockGame(tx: Tx, gameId: string) {
  await tx.$queryRaw`SELECT "id" FROM "TicTacToeSoloGame" WHERE "id" = ${gameId}::uuid FOR UPDATE`;
}

export function ticTacToeSoloDto(game: {
  id: string; board: string; status: string; result: string | null; xpReward: number; startedAt: Date; finishedAt: Date | null;
}) {
  return {
    id: game.id,
    board: game.board,
    status: game.status,
    result: game.result,
    xpReward: game.xpReward,
    startedAt: game.startedAt.toISOString(),
    finishedAt: game.finishedAt?.toISOString() ?? null,
    fullXpMatches: TIC_TAC_TOE_SOLO_FULL_XP_MATCHES,
  };
}

export async function createTicTacToeSoloGame(tx: Tx, studentId: string, requestId: string) {
  await assertGamesEnabled(tx);
  const creationKey = `tic-tac-toe-solo:create:${studentId}:${requestId}`;
  const replay = await tx.ticTacToeSoloGame.findUnique({ where: { creationKey } });
  if (replay) return { game: replay, replayed: true };
  const active = await tx.ticTacToeSoloGame.findFirst({ where: { studentId, status: "ACTIVE" }, orderBy: { startedAt: "desc" } });
  if (active) return { game: active, replayed: true };
  const game = await tx.ticTacToeSoloGame.create({ data: { studentId, creationKey } });
  await tx.auditLog.create({ data: { actorId: studentId, targetId: studentId, event: "TIC_TAC_TOE_MATCH_STARTED", details: { gameId: game.id, mode: "MACHINE" } } });
  return { game, replayed: false };
}

export async function playTicTacToeSoloMove(tx: Tx, studentId: string, gameId: string, cell: number, requestId: string) {
  await assertGamesEnabled(tx);
  await lockGame(tx, gameId);
  let game = await tx.ticTacToeSoloGame.findUnique({ where: { id: gameId } });
  if (!game || game.studentId !== studentId) throw new TicTacToeError("SOLO_GAME_NOT_FOUND");
  const actionKey = `tic-tac-toe-solo:${gameId}:move:${studentId}:${requestId}`;
  const replay = await tx.ticTacToeSoloAction.findUnique({ where: { actionKey } });
  if (replay) return { game, replayed: true };
  if (game.status !== "ACTIVE") throw new TicTacToeError("SOLO_GAME_NOT_ACTIVE");

  let board: string;
  try { board = applyTicTacToeMove(game.board, cell, "X"); }
  catch (error) { throw new TicTacToeError((error as Error).message); }

  let machineCell: number | null = null;
  let result: "HUMAN_WIN" | "MACHINE_WIN" | "DRAW" | null = ticTacToeWinner(board) === "X" ? "HUMAN_WIN" : board.includes("-") ? null : "DRAW";
  if (!result) {
    machineCell = ticTacToeMachineMove(board, randomInt(0, 1_000_000) / 1_000_000, randomInt(0, 1_000_000) / 1_000_000);
    board = applyTicTacToeMove(board, machineCell, "O");
    result = ticTacToeWinner(board) === "O" ? "MACHINE_WIN" : board.includes("-") ? null : "DRAW";
  }

  let xpReward = 0;
  const finishedAt = result ? new Date() : null;
  if (result === "HUMAN_WIN") {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${studentId}::uuid FOR UPDATE`;
    const day = getSchoolDay(finishedAt!);
    const finishedMatchesToday = await tx.ticTacToeSoloGame.count({ where: { studentId, status: "FINISHED", finishedAt: { gte: day.start, lt: day.end } } });
    xpReward = ticTacToeSoloXpAward(finishedMatchesToday);
    await tx.user.update({ where: { id: studentId }, data: { xp: { increment: xpReward } } });
    await tx.xpEntry.create({ data: { studentId, delta: xpReward, reason: "Vitória contra a máquina no jogo da velha", source: "TIC_TAC_TOE_RESULT", idempotencyKey: `tic-tac-toe-solo:${gameId}:xp` } });
  }

  game = await tx.ticTacToeSoloGame.update({
    where: { id: gameId },
    data: result ? { board, status: "FINISHED", result, xpReward, finishedAt } : { board },
  });
  await tx.ticTacToeSoloAction.create({ data: { gameId, actionKey, humanCell: cell, machineCell, board } });
  await tx.auditLog.create({
    data: { actorId: studentId, targetId: studentId, event: result ? "TIC_TAC_TOE_MATCH_FINISHED" : "TIC_TAC_TOE_MOVE_PLAYED", details: { gameId, mode: "MACHINE", cell, machineCell, result, xpReward } },
  });
  return { game, replayed: false };
}
