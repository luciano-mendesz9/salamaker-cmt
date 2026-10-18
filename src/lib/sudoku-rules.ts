import { randomInt } from "node:crypto";

export type SudokuDifficultyKey = "EASY" | "MEDIUM" | "HARD" | "EXPERT" | "MASTER";
export type SudokuHumanPlayAction = { kind: string; createdAt: Date | string };

export type SudokuHumanPlayAnalysis = {
  score: number;
  label: "VERY_LOW" | "LOW" | "MODERATE" | "HIGH";
  elapsedSeconds: number;
  valueActions: number;
  firstActionDelaySeconds: number | null;
  medianGapSeconds: number | null;
  rapidMovePercent: number;
  longestRapidSequence: number;
  solutionTranscriptionPattern: boolean;
};

export const DAILY_SUDOKU_XP_CAP = 180;

export const SUDOKU_DIFFICULTIES: Record<SudokuDifficultyKey, {
  label: string;
  clues: number;
  mistakeLimit: number;
  xpReward: number;
  extraMistakesCost: number;
  minimumRankingSeconds: number;
}> = {
  EASY: { label: "Fácil", clues: 42, mistakeLimit: 3, xpReward: 30, extraMistakesCost: 60, minimumRankingSeconds: 90 },
  MEDIUM: { label: "Médio", clues: 36, mistakeLimit: 5, xpReward: 50, extraMistakesCost: 80, minimumRankingSeconds: 180 },
  HARD: { label: "Difícil", clues: 31, mistakeLimit: 7, xpReward: 80, extraMistakesCost: 110, minimumRankingSeconds: 300 },
  EXPERT: { label: "Especialista", clues: 27, mistakeLimit: 9, xpReward: 120, extraMistakesCost: 150, minimumRankingSeconds: 420 },
  MASTER: { label: "Mestre", clues: 24, mistakeLimit: 12, xpReward: 180, extraMistakesCost: 200, minimumRankingSeconds: 600 },
};

export function calculateSudokuXpAward(configuredReward: number, xpEarnedToday: number) {
  return Math.max(0, Math.min(configuredReward, DAILY_SUDOKU_XP_CAP - Math.max(0, xpEarnedToday)));
}

export function isSudokuRankingTimeEligible(difficulty: SudokuDifficultyKey, elapsedSeconds: number) {
  return elapsedSeconds >= SUDOKU_DIFFICULTIES[difficulty].minimumRankingSeconds;
}

const expectedHumanSeconds: Record<SudokuDifficultyKey, number> = {
  EASY: 360,
  MEDIUM: 600,
  HARD: 780,
  EXPERT: 900,
  MASTER: 1_050,
};

function clamp(value: number, minimum = 0, maximum = 100) {
  return Math.max(minimum, Math.min(maximum, value));
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export function calculateSudokuHumanPlayScore(input: {
  difficulty: SudokuDifficultyKey;
  startedAt: Date | string;
  completedAt: Date | string;
  actions: SudokuHumanPlayAction[];
}): SudokuHumanPlayAnalysis {
  const startedAt = new Date(input.startedAt).getTime();
  const completedAt = new Date(input.completedAt).getTime();
  const elapsedSeconds = Math.max(1, Math.floor((completedAt - startedAt) / 1_000));
  const actionTimes = input.actions
    .filter((action) => action.kind === "VALUE")
    .map((action) => new Date(action.createdAt).getTime())
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
  const gaps = actionTimes.slice(1).map((time, index) => Math.max(0, (time - actionTimes[index]) / 1_000));
  const medianGapSeconds = median(gaps);
  const rapidGaps = gaps.filter((gap) => gap < 5).length;
  const rapidMovePercent = gaps.length === 0 ? 0 : Math.round((rapidGaps / gaps.length) * 100);
  let longestRapidSequence = actionTimes.length > 0 ? 1 : 0;
  let currentRapidSequence = longestRapidSequence;
  for (const gap of gaps) {
    currentRapidSequence = gap < 6 ? currentRapidSequence + 1 : 1;
    longestRapidSequence = Math.max(longestRapidSequence, currentRapidSequence);
  }
  const firstActionDelaySeconds = actionTimes.length === 0 ? null : Math.max(0, Math.round((actionTimes[0] - startedAt) / 1_000));
  const expectedSeconds = expectedHumanSeconds[input.difficulty];
  const durationScore = clamp(((elapsedSeconds - expectedSeconds * 0.4) / (expectedSeconds * 0.6)) * 100);
  const cadenceScore = medianGapSeconds === null ? 0 : clamp(((medianGapSeconds - 2) / 10) * 100);
  const rapidityScore = 100 - rapidMovePercent;
  const sequenceScore = clamp(((12 - longestRapidSequence) / 9) * 100);
  const solutionTranscriptionPattern = (firstActionDelaySeconds ?? 0) >= 60 && (medianGapSeconds ?? 99) < 5 && longestRapidSequence >= 10;
  const rawScore = durationScore * 0.4 + cadenceScore * 0.25 + rapidityScore * 0.2 + sequenceScore * 0.15 - (solutionTranscriptionPattern ? 15 : 0);
  const score = Math.round(clamp(rawScore));
  const label = score >= 75 ? "HIGH" : score >= 50 ? "MODERATE" : score >= 25 ? "LOW" : "VERY_LOW";
  return {
    score,
    label,
    elapsedSeconds,
    valueActions: actionTimes.length,
    firstActionDelaySeconds,
    medianGapSeconds: medianGapSeconds === null ? null : Number(medianGapSeconds.toFixed(1)),
    rapidMovePercent,
    longestRapidSequence,
    solutionTranscriptionPattern,
  };
}

function mulberry32(seed: number) {
  return () => {
    let value = seed += 0x6d2b79f5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4_294_967_296;
  };
}

function shuffled<T>(values: T[], random: () => number) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function pattern(row: number, column: number) {
  return (row * 3 + Math.floor(row / 3) + column) % 9;
}

export function generateSolvedSudoku(seed = randomInt(1, 2_147_483_647)) {
  const random = mulberry32(seed);
  const bands = shuffled([0, 1, 2], random);
  const stacks = shuffled([0, 1, 2], random);
  const rows = bands.flatMap((band) => shuffled([0, 1, 2], random).map((row) => band * 3 + row));
  const columns = stacks.flatMap((stack) => shuffled([0, 1, 2], random).map((column) => stack * 3 + column));
  const numbers = shuffled(["1", "2", "3", "4", "5", "6", "7", "8", "9"], random);
  return rows.flatMap((row) => columns.map((column) => numbers[pattern(row, column)])).join("");
}

function candidates(board: string[], index: number) {
  const row = Math.floor(index / 9);
  const column = index % 9;
  const used = new Set<string>();
  for (let cursor = 0; cursor < 9; cursor += 1) {
    used.add(board[row * 9 + cursor]);
    used.add(board[cursor * 9 + column]);
  }
  const boxRow = Math.floor(row / 3) * 3;
  const boxColumn = Math.floor(column / 3) * 3;
  for (let dy = 0; dy < 3; dy += 1) for (let dx = 0; dx < 3; dx += 1) used.add(board[(boxRow + dy) * 9 + boxColumn + dx]);
  return ["1", "2", "3", "4", "5", "6", "7", "8", "9"].filter((value) => !used.has(value));
}

export function countSudokuSolutions(value: string, limit = 2) {
  const board = [...value];
  let count = 0;
  function solve() {
    if (count >= limit) return;
    let bestIndex = -1;
    let bestCandidates: string[] | null = null;
    for (let index = 0; index < 81; index += 1) {
      if (board[index] !== "0") continue;
      const options = candidates(board, index);
      if (options.length === 0) return;
      if (!bestCandidates || options.length < bestCandidates.length) {
        bestIndex = index;
        bestCandidates = options;
        if (options.length === 1) break;
      }
    }
    if (bestIndex === -1) {
      count += 1;
      return;
    }
    for (const option of bestCandidates ?? []) {
      board[bestIndex] = option;
      solve();
      board[bestIndex] = "0";
    }
  }
  solve();
  return count;
}

export function createSudokuPuzzle(difficulty: SudokuDifficultyKey, seed = randomInt(1, 2_147_483_647)) {
  const config = SUDOKU_DIFFICULTIES[difficulty];
  if (!config) throw new Error("INVALID_DIFFICULTY");
  const solution = generateSolvedSudoku(seed);
  const random = mulberry32(seed ^ 0x5f3759df);
  const board = [...solution];
  for (const index of shuffled(Array.from({ length: 81 }, (_, cell) => cell), random)) {
    if (board.filter((cell) => cell !== "0").length <= config.clues) break;
    const previous = board[index];
    board[index] = "0";
    if (countSudokuSolutions(board.join("")) !== 1) board[index] = previous;
  }
  return { puzzle: board.join(""), solution };
}

export function sudokuBoardComplete(board: string, solution: string) {
  return board === solution;
}
