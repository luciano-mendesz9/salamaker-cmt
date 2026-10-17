import assert from "node:assert/strict";
import test from "node:test";
import { applyTicTacToeMove, bestTicTacToeMove, ticTacToeSettlement, ticTacToeWinner } from "./tic-tac-toe-rules";

test("jogo da velha detecta vitória e bloqueia casa ocupada", () => {
  assert.equal(ticTacToeWinner("XXXOO----"), "X");
  assert.equal(ticTacToeWinner("XO-XO-X--"), "X");
  assert.throws(() => applyTicTacToeMove("X--------", 0, "O"), /CELL_OCCUPIED/);
});

test("máquina bloqueia uma vitória imediata do aluno", () => {
  assert.equal(bestTicTacToeMove("XX--O----", "O"), 2);
});

test("aposta do jogo da velha aplica 85% e exige mais de 10 DC", () => {
  assert.deepEqual(ticTacToeSettlement(50), { total: 100, winnerPayout: 85, taxAmount: 15 });
  assert.throws(() => ticTacToeSettlement(10), /INVALID_WAGER/);
});
