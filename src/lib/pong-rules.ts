export const PONG_ROOM_FEE = 50;
export const PONG_MIN_WAGER = 10;
export const PONG_MAX_WAGER = 100;
export const PONG_DAILY_ROOM_LIMIT = 3;
export const PONG_WIN_SCORE = 10;
export const PONG_LOSER_XP_PENALTY = 50;
export const PONG_DISCONNECT_GRACE_MS = 3 * 60_000;
export const PONG_JOIN_REQUEST_TTL_MS = 5 * 60_000;

export const PONG_WIDTH = 960;
export const PONG_HEIGHT = 540;
export const PONG_PADDLE_WIDTH = 150;
export const PONG_PADDLE_HEIGHT = 14;
export const PONG_PADDLE_MARGIN = 30;
export const PONG_BALL_RADIUS = 9;

const BASE_BALL_SPEED = 285;
const BASE_PADDLE_SPEED = 430;
const SPEED_LEVEL_MS = 15_000;
const MAX_SPEED_LEVEL = 8;

export type PongSeat = "OWNER" | "GUEST";
export type PongInput = -1 | 0 | 1;

export type PongPhysicsState = {
  ball: { x: number; y: number; vx: number; vy: number };
  ownerX: number;
  guestX: number;
  ownerScore: number;
  guestScore: number;
  scoreSequence: number;
  elapsedMs: number;
  speedLevel: number;
  tick: number;
  roundPauseMs: number;
};

export function pongSettlement(wager: number) {
  if (!Number.isInteger(wager) || wager < PONG_MIN_WAGER || wager > PONG_MAX_WAGER) {
    throw new Error("INVALID_WAGER");
  }
  const total = wager * 2;
  const winnerPayout = Math.floor(total * 0.7);
  return { total, winnerPayout, taxAmount: total - winnerPayout };
}

function serveVelocity(sequence: number, toward: PongSeat) {
  const horizontalSign = sequence % 2 === 0 ? 1 : -1;
  const horizontal = BASE_BALL_SPEED * 0.42 * horizontalSign;
  const vertical = Math.sqrt(BASE_BALL_SPEED ** 2 - horizontal ** 2) * (toward === "OWNER" ? 1 : -1);
  return { vx: horizontal, vy: vertical };
}

export function createPongPhysicsState(ownerScore = 0, guestScore = 0, scoreSequence = 0): PongPhysicsState {
  const velocity = serveVelocity(scoreSequence, scoreSequence % 2 === 0 ? "GUEST" : "OWNER");
  return {
    ball: { x: PONG_WIDTH / 2, y: PONG_HEIGHT / 2, ...velocity },
    ownerX: (PONG_WIDTH - PONG_PADDLE_WIDTH) / 2,
    guestX: (PONG_WIDTH - PONG_PADDLE_WIDTH) / 2,
    ownerScore,
    guestScore,
    scoreSequence,
    elapsedMs: 0,
    speedLevel: 0,
    tick: 0,
    roundPauseMs: 900,
  };
}

function clampPaddle(value: number) {
  return Math.max(0, Math.min(PONG_WIDTH - PONG_PADDLE_WIDTH, value));
}

function bounceFromPaddle(state: PongPhysicsState, paddleX: number, seat: PongSeat, speedMultiplier: number) {
  const paddleCenter = paddleX + PONG_PADDLE_WIDTH / 2;
  const offset = Math.max(-1, Math.min(1, (state.ball.x - paddleCenter) / (PONG_PADDLE_WIDTH / 2)));
  const currentSpeed = Math.hypot(state.ball.vx, state.ball.vy);
  const speed = Math.min(BASE_BALL_SPEED * 2.15, Math.max(BASE_BALL_SPEED, currentSpeed * 1.025 * speedMultiplier));
  const vx = speed * 0.72 * offset;
  const vy = Math.sqrt(Math.max(1, speed ** 2 - vx ** 2)) * (seat === "OWNER" ? -1 : 1);
  state.ball.vx = vx;
  state.ball.vy = vy;
}

function resetAfterPoint(state: PongPhysicsState, scorer: PongSeat) {
  const velocity = serveVelocity(state.scoreSequence, scorer === "OWNER" ? "GUEST" : "OWNER");
  state.ball = { x: PONG_WIDTH / 2, y: PONG_HEIGHT / 2, ...velocity };
  state.roundPauseMs = 900;
}

export function stepPongPhysics(
  previous: PongPhysicsState,
  deltaMs: number,
  inputs: { owner: PongInput; guest: PongInput },
): { state: PongPhysicsState; scored: PongSeat | null } {
  const state: PongPhysicsState = {
    ...previous,
    ball: { ...previous.ball },
    elapsedMs: previous.elapsedMs + deltaMs,
    tick: previous.tick + 1,
  };
  state.speedLevel = Math.min(MAX_SPEED_LEVEL, Math.floor(state.elapsedMs / SPEED_LEVEL_MS));
  const paddleSpeed = Math.min(680, BASE_PADDLE_SPEED * 1.045 ** state.speedLevel);
  const distance = paddleSpeed * (deltaMs / 1000);
  state.ownerX = clampPaddle(state.ownerX + inputs.owner * distance);
  state.guestX = clampPaddle(state.guestX + inputs.guest * distance);

  if (state.roundPauseMs > 0) {
    state.roundPauseMs = Math.max(0, state.roundPauseMs - deltaMs);
    return { state, scored: null };
  }

  const speedMultiplier = 1 + state.speedLevel * 0.035;
  const previousBallY = state.ball.y;
  state.ball.x += state.ball.vx * speedMultiplier * (deltaMs / 1000);
  state.ball.y += state.ball.vy * speedMultiplier * (deltaMs / 1000);

  if (state.ball.x - PONG_BALL_RADIUS <= 0 && state.ball.vx < 0) {
    state.ball.x = PONG_BALL_RADIUS;
    state.ball.vx = Math.abs(state.ball.vx);
  } else if (state.ball.x + PONG_BALL_RADIUS >= PONG_WIDTH && state.ball.vx > 0) {
    state.ball.x = PONG_WIDTH - PONG_BALL_RADIUS;
    state.ball.vx = -Math.abs(state.ball.vx);
  }

  const guestY = PONG_PADDLE_MARGIN;
  const ownerY = PONG_HEIGHT - PONG_PADDLE_MARGIN - PONG_PADDLE_HEIGHT;
  const withinGuest = state.ball.x + PONG_BALL_RADIUS >= state.guestX && state.ball.x - PONG_BALL_RADIUS <= state.guestX + PONG_PADDLE_WIDTH;
  const withinOwner = state.ball.x + PONG_BALL_RADIUS >= state.ownerX && state.ball.x - PONG_BALL_RADIUS <= state.ownerX + PONG_PADDLE_WIDTH;

  if (state.ball.vy < 0 && withinGuest && previousBallY - PONG_BALL_RADIUS >= guestY + PONG_PADDLE_HEIGHT && state.ball.y - PONG_BALL_RADIUS <= guestY + PONG_PADDLE_HEIGHT) {
    state.ball.y = guestY + PONG_PADDLE_HEIGHT + PONG_BALL_RADIUS;
    bounceFromPaddle(state, state.guestX, "GUEST", speedMultiplier);
  } else if (state.ball.vy > 0 && withinOwner && previousBallY + PONG_BALL_RADIUS <= ownerY && state.ball.y + PONG_BALL_RADIUS >= ownerY) {
    state.ball.y = ownerY - PONG_BALL_RADIUS;
    bounceFromPaddle(state, state.ownerX, "OWNER", speedMultiplier);
  }

  let scored: PongSeat | null = null;
  if (state.ball.y < -PONG_BALL_RADIUS) {
    state.ownerScore += 1;
    state.scoreSequence += 1;
    scored = "OWNER";
  } else if (state.ball.y > PONG_HEIGHT + PONG_BALL_RADIUS) {
    state.guestScore += 1;
    state.scoreSequence += 1;
    scored = "GUEST";
  }
  if (scored) resetAfterPoint(state, scored);
  return { state, scored };
}
