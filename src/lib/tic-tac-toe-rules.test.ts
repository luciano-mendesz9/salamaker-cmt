import assert from "node:assert/strict";
import test from "node:test";
import { applyTicTacToeMove, bestTicTacToeMove, TIC_TAC_TOE_DAILY_OPPONENT_LIMIT, TIC_TAC_TOE_LOSS_XP_PENALTY, ticTacToeMachineMove, ticTacToeSettlement, ticTacToeSoloXpAward, ticTacToeWinner } from "./tic-tac-toe-rules";

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

test("máquina alterna entre a melhor jogada e uma jogada imperfeita válida", () => {
  assert.equal(ticTacToeMachineMove("XX--O----", 0.1, 0.5), 2);
  assert.equal(ticTacToeMachineMove("XX--O----", 0.989, 0.5), 2);
  const imperfect = ticTacToeMachineMove("XX--O----", 0.995, 0);
  assert.notEqual(imperfect, 2);
  assert.equal("XX--O----"[imperfect], "-");
});

test("vitória contra a máquina paga 25 XP nas 5 primeiras partidas e 15 XP depois", () => {
  assert.equal(ticTacToeSoloXpAward(0), 25);
  assert.equal(ticTacToeSoloXpAward(4), 25);
  assert.equal(ticTacToeSoloXpAward(5), 15);
  assert.equal(ticTacToeSoloXpAward(500), 15);
});

test("multiplayer limita a dupla a 3 partidas por dia e desconta 50 XP do perdedor", () => {
  assert.equal(TIC_TAC_TOE_DAILY_OPPONENT_LIMIT, 3);
  assert.equal(TIC_TAC_TOE_LOSS_XP_PENALTY, 50);
});
