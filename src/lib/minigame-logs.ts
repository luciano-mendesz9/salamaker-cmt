import { prisma } from "@/lib/db";
import { calculateSudokuHumanPlayScore, SUDOKU_DIFFICULTIES, type SudokuDifficultyKey } from "@/lib/sudoku-rules";

const person = (user: { firstName: string; lastName: string; accessCode: string } | null | undefined) => user
  ? `${user.firstName} ${user.lastName} (${user.accessCode})`
  : "—";

export async function getMinigameLogs(page = 1, pageSize = 50) {
  const safePage = Math.max(1, Math.floor(page));
  const skip = (safePage - 1) * pageSize;
  const [pongRooms, ticTacToeRounds, sudokuGames, pongTotal, ticTacToeTotal, sudokuTotal] = await Promise.all([
    prisma.pongRoom.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        owner: { select: { firstName: true, lastName: true, accessCode: true } },
        winner: { select: { firstName: true, lastName: true, accessCode: true } },
        loser: { select: { firstName: true, lastName: true, accessCode: true } },
        players: { include: { student: { select: { firstName: true, lastName: true, accessCode: true } } }, orderBy: { seat: "asc" } },
      },
    }),
    prisma.ticTacToeRound.findMany({
      orderBy: { finishedAt: "desc" },
      skip,
      take: pageSize,
      include: {
        winner: { select: { firstName: true, lastName: true, accessCode: true } },
        room: { include: { owner: { select: { firstName: true, lastName: true, accessCode: true } }, guest: { select: { firstName: true, lastName: true, accessCode: true } } } },
      },
    }),
    prisma.sudokuGame.findMany({
      orderBy: { startedAt: "desc" },
      skip,
      take: pageSize,
      include: {
        student: { select: { firstName: true, lastName: true, accessCode: true } },
        actions: { select: { kind: true, createdAt: true }, orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.pongRoom.count(),
    prisma.ticTacToeRound.count(),
    prisma.sudokuGame.count(),
  ]);

  const pong = pongRooms.map((room) => {
    const owner = room.players.find((player) => player.seat === "OWNER");
    const guest = room.players.find((player) => player.seat === "GUEST");
    return {
      id: room.id,
      code: room.code,
      status: room.status,
      owner: person(owner?.student ?? room.owner),
      guest: person(guest?.student),
      wager: room.wager,
      ownerStake: owner?.stake ?? 0,
      guestStake: guest?.stake ?? 0,
      ownerScore: room.ownerScore,
      guestScore: room.guestScore,
      winner: person(room.winner),
      loser: person(room.loser),
      winnerPayout: room.winnerPayout,
      taxAmount: room.taxAmount,
      finishReason: room.finishReason,
      createdAt: room.createdAt.toISOString(),
      startedAt: room.startedAt?.toISOString() ?? null,
      finishedAt: room.finishedAt?.toISOString() ?? null,
    };
  });

  const ticTacToe = ticTacToeRounds.map((round) => ({
    id: round.id,
    code: round.room.code,
    round: round.round,
    owner: person(round.room.owner),
    guest: person(round.room.guest),
    wager: round.room.wager,
    board: round.board,
    winner: round.isDraw ? "Empate" : person(round.winner),
    winnerPayout: round.winnerPayout,
    taxAmount: round.taxAmount,
    isDraw: round.isDraw,
    startedAt: round.startedAt.toISOString(),
    finishedAt: round.finishedAt.toISOString(),
  }));

  const sudoku = sudokuGames.map((game) => {
    const difficulty = game.difficulty as SudokuDifficultyKey;
    const computed = game.completedAt
      ? calculateSudokuHumanPlayScore({ difficulty, startedAt: game.startedAt, completedAt: game.completedAt, actions: game.actions })
      : null;
    return {
      id: game.id,
      student: person(game.student),
      difficulty: game.difficulty,
      difficultyLabel: SUDOKU_DIFFICULTIES[difficulty].label,
      status: game.status,
      elapsedSeconds: game.elapsedSeconds,
      mistakes: game.mistakes,
      hintsUsed: game.hintsUsed,
      extraMistakesPurchased: game.extraMistakesPurchased,
      eligibleForRanking: game.eligibleForRanking,
      xpReward: game.status === "COMPLETED" ? game.xpReward : 0,
      humanPlayScore: game.humanPlayScore ?? computed?.score ?? null,
      humanPlayLabel: computed?.label ?? null,
      medianGapSeconds: computed?.medianGapSeconds ?? null,
      rapidMovePercent: computed?.rapidMovePercent ?? null,
      longestRapidSequence: computed?.longestRapidSequence ?? null,
      firstActionDelaySeconds: computed?.firstActionDelaySeconds ?? null,
      solutionTranscriptionPattern: computed?.solutionTranscriptionPattern ?? false,
      valueActions: computed?.valueActions ?? game.actions.filter((action) => action.kind === "VALUE").length,
      startedAt: game.startedAt.toISOString(),
      completedAt: game.completedAt?.toISOString() ?? null,
    };
  });

  return { pong, ticTacToe, sudoku, totals: { pong: pongTotal, ticTacToe: ticTacToeTotal, sudoku: sudokuTotal }, page: safePage, pageSize };
}

export type MinigameLogsData = Awaited<ReturnType<typeof getMinigameLogs>>;
