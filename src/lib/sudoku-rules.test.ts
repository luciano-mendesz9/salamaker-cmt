import assert from "node:assert/strict";
import test from "node:test";
import { calculateSudokuXpAward, countSudokuSolutions, createSudokuPuzzle, DAILY_SUDOKU_XP_CAP, generateSolvedSudoku, isSudokuRankingTimeEligible, SUDOKU_DIFFICULTIES } from "./sudoku-rules";

function validGroup(values: string) { return [...values].sort().join("") === "123456789"; }

test("gerador cria solução Sudoku válida", () => {
  const solution = generateSolvedSudoku(42);
  assert.equal(solution.length, 81);
  for (let row = 0; row < 9; row += 1) assert.equal(validGroup(solution.slice(row * 9, row * 9 + 9)), true);
  for (let column = 0; column < 9; column += 1) assert.equal(validGroup(Array.from({ length: 9 }, (_, row) => solution[row * 9 + column]).join("")), true);
});

test("tabuleiro fácil mantém solução única e quantidade planejada de pistas", () => {
  const result = createSudokuPuzzle("EASY", 1234);
  assert.equal(result.puzzle.replaceAll("0", "").length, SUDOKU_DIFFICULTIES.EASY.clues);
  assert.equal(countSudokuSolutions(result.puzzle), 1);
});

test("recompensa de Sudoku respeita o teto diário", () => {
  assert.equal(DAILY_SUDOKU_XP_CAP, 180);
  assert.equal(calculateSudokuXpAward(80, 0), 80);
  assert.equal(calculateSudokuXpAward(120, 100), 80);
  assert.equal(calculateSudokuXpAward(180, 180), 0);
  assert.equal(calculateSudokuXpAward(30, 999), 0);
});

test("ranking rejeita conclusões abaixo do tempo mínimo da dificuldade", () => {
  assert.equal(isSudokuRankingTimeEligible("EASY", 89), false);
  assert.equal(isSudokuRankingTimeEligible("EASY", 90), true);
  assert.equal(isSudokuRankingTimeEligible("MASTER", 599), false);
  assert.equal(isSudokuRankingTimeEligible("MASTER", 600), true);
});
