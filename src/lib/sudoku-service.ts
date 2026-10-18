import { Prisma, type SudokuDifficulty } from "@/generated/prisma/client";
import { SCHOOL_TIME_ZONE, schoolLocalToUtc } from "@/lib/activities";
import { prisma } from "@/lib/db";
import { calculateSudokuHumanPlayScore, calculateSudokuXpAward, createSudokuPuzzle, DAILY_SUDOKU_XP_CAP, isSudokuRankingTimeEligible, SUDOKU_DIFFICULTIES, sudokuBoardComplete, type SudokuDifficultyKey } from "@/lib/sudoku-rules";
import { creditTreasury } from "@/lib/treasury";

type Tx = Prisma.TransactionClient;
export class SudokuError extends Error {}

async function lockGame(tx: Tx, gameId: string) {
  await tx.$queryRaw`SELECT "id" FROM "SudokuGame" WHERE "id" = ${gameId}::uuid FOR UPDATE`;
}

async function assertGamesEnabled(tx: Tx) {
  const settings = await tx.appSetting.upsert({ where: { id: 1 }, create: { id: 1 }, update: {}, select: { gamesEnabled: true } });
  if (!settings.gamesEnabled) throw new SudokuError("GAMES_DISABLED");
}

type SudokuRecord = Awaited<ReturnType<Tx["sudokuGame"]["findUniqueOrThrow"]>>;

function schoolDateKey(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function nextDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

function schoolDayBounds(now: Date, timeZone: string) {
  const dateKey = schoolDateKey(now, timeZone);
  return {
    start: new Date(schoolLocalToUtc(`${dateKey}T00:00`, timeZone)),
    end: new Date(schoolLocalToUtc(`${nextDateKey(dateKey)}T00:00`, timeZone)),
  };
}

async function sudokuXpEarnedInSchoolDay(tx: Tx, studentId: string, now: Date, timeZone: string) {
  const { start, end } = schoolDayBounds(now, timeZone);
  const result = await tx.xpEntry.aggregate({
    where: { studentId, source: "SUDOKU_RESULT", createdAt: { gte: start, lt: end } },
    _sum: { delta: true },
  });
  return Math.max(0, result._sum.delta ?? 0);
}

export function sudokuGameDto(game: SudokuRecord) {
  const config = SUDOKU_DIFFICULTIES[game.difficulty as SudokuDifficultyKey];
  return {
    id: game.id,
    difficulty: game.difficulty,
    difficultyLabel: config.label,
    puzzle: game.puzzle,
    board: game.board,
    status: game.status,
    mistakes: game.mistakes,
    mistakeLimit: game.mistakeLimit,
    remainingMistakes: Math.max(0, game.mistakeLimit - game.mistakes),
    hintsUsed: game.hintsUsed,
    hintsRemaining: Math.max(0, 3 - game.hintsUsed),
    extraMistakesPurchased: game.extraMistakesPurchased,
    extraMistakesCost: config.extraMistakesCost,
    eligibleForRanking: game.eligibleForRanking,
    xpReward: game.xpReward,
    elapsedSeconds: game.elapsedSeconds,
    humanPlayScore: game.humanPlayScore,
    startedAt: game.startedAt.toISOString(),
    completedAt: game.completedAt?.toISOString() ?? null,
  };
}

async function finishIfComplete(tx: Tx, game: SudokuRecord, board: string, finalActionKind: "VALUE" | "HINT") {
  if (!sudokuBoardComplete(board, game.solution)) return tx.sudokuGame.update({ where: { id: game.id }, data: { board } });
  const completedAt = new Date();
  const elapsedSeconds = Math.max(1, Math.floor((completedAt.getTime() - game.startedAt.getTime()) / 1000));
  const completionKey = `sudoku:${game.id}:complete`;
  const difficulty = game.difficulty as SudokuDifficultyKey;
  const persistedActions = await tx.sudokuAction.findMany({ where: { gameId: game.id }, select: { kind: true, createdAt: true }, orderBy: { createdAt: "asc" } });
  const humanPlay = calculateSudokuHumanPlayScore({ difficulty, startedAt: game.startedAt, completedAt, actions: finalActionKind === "VALUE" ? [...persistedActions, { kind: "VALUE", createdAt: completedAt }] : persistedActions });
  const settings = await tx.appSetting.findUnique({ where: { id: 1 }, select: { timeZone: true } });
  const timeZone = settings?.timeZone ?? SCHOOL_TIME_ZONE;
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${game.studentId}::uuid FOR UPDATE`;
  const xpEarnedToday = await sudokuXpEarnedInSchoolDay(tx, game.studentId, completedAt, timeZone);
  const awardedXp = calculateSudokuXpAward(game.xpReward, xpEarnedToday);
  const eligibleForRanking = game.eligibleForRanking && awardedXp > 0 && isSudokuRankingTimeEligible(difficulty, elapsedSeconds);
  if (awardedXp > 0) {
    await tx.user.update({ where: { id: game.studentId }, data: { xp: { increment: awardedXp } } });
    await tx.xpEntry.create({ data: { studentId: game.studentId, delta: awardedXp, reason: `Sudoku ${SUDOKU_DIFFICULTIES[difficulty].label} concluído`, source: "SUDOKU_RESULT", idempotencyKey: completionKey } });
  }
  const updated = await tx.sudokuGame.update({ where: { id: game.id }, data: { board, status: "COMPLETED", completedAt, elapsedSeconds, completionKey, xpReward: awardedXp, eligibleForRanking, humanPlayScore: humanPlay.score, humanPlaySignals: humanPlay as Prisma.InputJsonValue } });
  await tx.auditLog.create({ data: { actorId: game.studentId, targetId: game.studentId, event: "SUDOKU_GAME_FINISHED", details: { gameId: game.id, difficulty: game.difficulty, elapsedSeconds, mistakes: game.mistakes, hintsUsed: game.hintsUsed, eligibleForRanking, configuredXpReward: game.xpReward, awardedXp, xpEarnedBeforeCompletion: xpEarnedToday, dailyXpCap: DAILY_SUDOKU_XP_CAP, humanPlayScore: humanPlay.score } } });
  return updated;
}

export async function createSudokuGame(tx: Tx, studentId: string, difficulty: SudokuDifficulty) {
  await assertGamesEnabled(tx);
  const config = SUDOKU_DIFFICULTIES[difficulty as SudokuDifficultyKey];
  if (!config) throw new SudokuError("INVALID_DIFFICULTY");
  const { puzzle, solution } = createSudokuPuzzle(difficulty as SudokuDifficultyKey);
  const game = await tx.sudokuGame.create({ data: { studentId, difficulty, puzzle, solution, board: puzzle, mistakeLimit: config.mistakeLimit, xpReward: config.xpReward } });
  await tx.auditLog.create({ data: { actorId: studentId, targetId: studentId, event: "SUDOKU_GAME_STARTED", details: { gameId: game.id, difficulty, mistakeLimit: config.mistakeLimit, xpReward: config.xpReward } } });
  return game;
}

export async function getSudokuGame(studentId: string, gameId: string) {
  const game = await prisma.sudokuGame.findFirst({ where: { id: gameId, studentId } });
  if (!game) throw new SudokuError("GAME_NOT_FOUND");
  return sudokuGameDto(game);
}

export async function playSudokuValue(tx: Tx, studentId: string, gameId: string, cell: number, value: number, requestId: string) {
  await assertGamesEnabled(tx);
  await lockGame(tx, gameId);
  const game = await tx.sudokuGame.findFirst({ where: { id: gameId, studentId } });
  if (!game) throw new SudokuError("GAME_NOT_FOUND");
  const actionKey = `sudoku:${game.id}:move:${studentId}:${requestId}`;
  if (await tx.sudokuAction.findUnique({ where: { actionKey } })) return game;
  if (game.status !== "ACTIVE") throw new SudokuError("GAME_NOT_ACTIVE");
  if (!Number.isInteger(cell) || cell < 0 || cell > 80 || !Number.isInteger(value) || value < 1 || value > 9) throw new SudokuError("INVALID_MOVE");
  if (game.puzzle[cell] !== "0") throw new SudokuError("FIXED_CELL");
  if (game.board[cell] !== "0") throw new SudokuError("CELL_ALREADY_SOLVED");
  if (game.solution[cell] !== String(value)) {
    const mistakes = game.mistakes + 1;
    const failed = mistakes >= game.mistakeLimit;
    const updated = await tx.sudokuGame.update({ where: { id: game.id }, data: { mistakes, status: failed ? "FAILED" : "ACTIVE" } });
    await tx.sudokuAction.create({ data: { gameId: game.id, actionKey, kind: "MISTAKE", cell, value } });
    if (failed) await tx.auditLog.create({ data: { actorId: studentId, targetId: studentId, event: "SUDOKU_GAME_FINISHED", details: { gameId, difficulty: game.difficulty, failed: true, mistakes } } });
    return updated;
  }
  const board = `${game.board.slice(0, cell)}${value}${game.board.slice(cell + 1)}`;
  const updated = await finishIfComplete(tx, game, board, "VALUE");
  await tx.sudokuAction.create({ data: { gameId: game.id, actionKey, kind: "VALUE", cell, value } });
  return updated;
}

export async function revealSudokuHint(tx: Tx, studentId: string, gameId: string, requestId: string) {
  await assertGamesEnabled(tx);
  await lockGame(tx, gameId);
  const game = await tx.sudokuGame.findFirst({ where: { id: gameId, studentId } });
  if (!game) throw new SudokuError("GAME_NOT_FOUND");
  const actionKey = `sudoku:${game.id}:hint:${studentId}:${requestId}`;
  if (await tx.sudokuAction.findUnique({ where: { actionKey } })) return game;
  if (game.status !== "ACTIVE") throw new SudokuError("GAME_NOT_ACTIVE");
  if (game.hintsUsed >= 3) throw new SudokuError("NO_HINTS_LEFT");
  const emptyCells = [...game.board].map((value, index) => value === "0" ? index : -1).filter((index) => index >= 0);
  if (emptyCells.length === 0) throw new SudokuError("NO_EMPTY_CELLS");
  const cell = emptyCells[(game.hintsUsed * 17 + game.mistakes * 7) % emptyCells.length];
  const board = `${game.board.slice(0, cell)}${game.solution[cell]}${game.board.slice(cell + 1)}`;
  const withHint = await tx.sudokuGame.update({ where: { id: game.id }, data: { hintsUsed: { increment: 1 }, eligibleForRanking: false } });
  const updated = await finishIfComplete(tx, withHint, board, "HINT");
  await tx.sudokuAction.create({ data: { gameId: game.id, actionKey, kind: "HINT", cell, value: Number(game.solution[cell]) } });
  await tx.auditLog.create({ data: { actorId: studentId, targetId: studentId, event: "SUDOKU_HINT_USED", details: { gameId, cell, hintsUsed: game.hintsUsed + 1 } } });
  return updated;
}

export async function purchaseSudokuErrors(tx: Tx, studentId: string, gameId: string, requestId: string) {
  await assertGamesEnabled(tx);
  await lockGame(tx, gameId);
  const game = await tx.sudokuGame.findFirst({ where: { id: gameId, studentId } });
  if (!game) throw new SudokuError("GAME_NOT_FOUND");
  const actionKey = `sudoku:${game.id}:extra-errors:${studentId}:${requestId}`;
  if (await tx.sudokuAction.findUnique({ where: { actionKey } })) return game;
  if (game.status !== "ACTIVE") throw new SudokuError("GAME_NOT_ACTIVE");
  if (game.extraMistakesPurchased) throw new SudokuError("EXTRA_ERRORS_ALREADY_PURCHASED");
  const cost = SUDOKU_DIFFICULTIES[game.difficulty as SudokuDifficultyKey].extraMistakesCost;
  const debit = await tx.user.updateMany({ where: { id: studentId, devCoins: { gte: cost } }, data: { devCoins: { decrement: cost } } });
  if (debit.count !== 1) throw new SudokuError("INSUFFICIENT_DEV_COINS");
  const entry = await tx.devCoinEntry.create({ data: { studentId, authorId: studentId, delta: -cost, reason: `Compra de 2 erros extras no Sudoku ${SUDOKU_DIFFICULTIES[game.difficulty as SudokuDifficultyKey].label}`, source: "SUDOKU_EXTRA_ERRORS", idempotencyKey: actionKey } });
  await creditTreasury(tx, cost, { reason: `Compra de erros extras no Sudoku ${game.id}`, source: "SUDOKU_EXTRA_ERRORS", idempotencyKey: `${actionKey}:treasury`, devCoinEntryId: entry.id });
  const updated = await tx.sudokuGame.update({ where: { id: game.id }, data: { mistakeLimit: { increment: 2 }, extraMistakesPurchased: true, eligibleForRanking: false } });
  await tx.sudokuAction.create({ data: { gameId: game.id, actionKey, kind: "EXTRA_ERRORS" } });
  await tx.auditLog.create({ data: { actorId: studentId, targetId: studentId, event: "SUDOKU_EXTRA_ERRORS_PURCHASED", details: { gameId, cost, addedMistakes: 2 } } });
  return updated;
}

export async function getSudokuHome(studentId: string) {
  const settings = await prisma.appSetting.upsert({ where: { id: 1 }, create: { id: 1 }, update: {}, select: { gamesEnabled: true, timeZone: true } });
  const { start, end } = schoolDayBounds(new Date(), settings.timeZone);
  const [activeGames, student, dailyXp] = await Promise.all([
    prisma.sudokuGame.findMany({ where: { studentId, status: "ACTIVE" }, orderBy: { startedAt: "desc" }, take: 5, select: { id: true, difficulty: true, startedAt: true, mistakes: true, mistakeLimit: true } }),
    prisma.user.findUniqueOrThrow({ where: { id: studentId }, select: { devCoins: true } }),
    prisma.xpEntry.aggregate({ where: { studentId, source: "SUDOKU_RESULT", createdAt: { gte: start, lt: end } }, _sum: { delta: true } }),
  ]);
  const sudokuXpEarnedToday = Math.max(0, dailyXp._sum.delta ?? 0);
  return { gamesEnabled: settings.gamesEnabled, devCoins: student.devCoins, sudokuXpDailyCap: DAILY_SUDOKU_XP_CAP, sudokuXpEarnedToday, sudokuXpRemainingToday: Math.max(0, DAILY_SUDOKU_XP_CAP - sudokuXpEarnedToday), activeGames: activeGames.map((game) => ({ ...game, startedAt: game.startedAt.toISOString() })) };
}

export async function getSudokuRanking(difficulty: SudokuDifficultyKey) {
  const games = await prisma.sudokuGame.findMany({
    where: { difficulty, status: "COMPLETED", eligibleForRanking: true, elapsedSeconds: { not: null }, student: { status: "ACTIVE", role: "STUDENT" } },
    orderBy: [{ elapsedSeconds: "asc" }, { completedAt: "asc" }],
    distinct: ["studentId"],
    take: 100,
    select: { id: true, studentId: true, elapsedSeconds: true, completedAt: true, student: { select: { firstName: true, lastName: true, profileAvatar: true, originSchoolClass: true } } },
  });
  return games;
}
