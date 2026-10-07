import assert from "node:assert/strict";
import test from "node:test";
import {
  createPongPhysicsState,
  PONG_BALL_RADIUS,
  PONG_HEIGHT,
  PONG_WIN_SCORE,
  pongSettlement,
  stepPongPhysics,
} from "./pong-rules";

test("Pong entrega 70% inteiro ao vencedor e conserva o restante como imposto", () => {
  assert.deepEqual(pongSettlement(10), { total: 20, winnerPayout: 14, taxAmount: 6 });
  assert.deepEqual(pongSettlement(11), { total: 22, winnerPayout: 15, taxAmount: 7 });
  assert.throws(() => pongSettlement(9), /INVALID_WAGER/);
  assert.throws(() => pongSettlement(101), /INVALID_WAGER/);
});

test("Pong registra ponto do convidado quando a bola sai pela parte inferior", () => {
  const initial = createPongPhysicsState();
  initial.roundPauseMs = 0;
  initial.ball.y = PONG_HEIGHT + PONG_BALL_RADIUS + 1;
  initial.ball.vy = 200;
  const result = stepPongPhysics(initial, 16, { owner: 0, guest: 0 });
  assert.equal(result.scored, "GUEST");
  assert.equal(result.state.guestScore, 1);
  assert.equal(result.state.scoreSequence, 1);
});

test("Pong aumenta o estágio de velocidade durante a partida", () => {
  const initial = createPongPhysicsState(PONG_WIN_SCORE - 1, 0, 2);
  initial.roundPauseMs = 0;
  const result = stepPongPhysics(initial, 30_000, { owner: 0, guest: 0 });
  assert.equal(result.state.speedLevel, 2);
});
