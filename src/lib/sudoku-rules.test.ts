import assert from "node:assert/strict";
import test from "node:test";
import { countSudokuSolutions, createSudokuPuzzle, generateSolvedSudoku, SUDOKU_DIFFICULTIES } from "./sudoku-rules";

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
