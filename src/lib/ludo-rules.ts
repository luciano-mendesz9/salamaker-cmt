export const LUDO_COLORS = ["RED", "GREEN", "YELLOW", "BLUE"] as const;
export type LudoColor = (typeof LUDO_COLORS)[number];

export const LUDO_BASE = -1;
export const LUDO_FINISH = 57;
export const LUDO_TRACK_LAST = 51;
export const LUDO_TURN_SECONDS = 10;
export const LUDO_DISCONNECT_GRACE_MS = 3 * 60_000;
export const LUDO_ROOM_FEE = 50;
export const LUDO_CREATOR_START_XP_FEE = 100;
export const LUDO_FORFEIT_XP_FEE = 100;
export const LUDO_INVITE_BATCH_SIZE = 5;
export const LUDO_INVITE_BATCH_XP_FEE = 10;
export const LUDO_BOT_WAGER = 50;

const COLOR_START: Record<LudoColor, number> = { RED: 0, GREEN: 13, YELLOW: 26, BLUE: 39 };
const SAFE_GLOBAL_SQUARES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

export type LudoPieceSet = [number, number, number, number];
export type LudoRulePlayer = { id: string; color: LudoColor; pieces: LudoPieceSet };

export function parsePieces(value: unknown): LudoPieceSet {
  if (!Array.isArray(value) || value.length !== 4 || value.some(item => !Number.isInteger(item) || item < LUDO_BASE || item > LUDO_FINISH)) {
    throw new Error("INVALID_LUDO_PIECES");
  }
  return [...value] as LudoPieceSet;
}

export function globalTrackSquare(color: LudoColor, position: number) {
  if (position < 0 || position > LUDO_TRACK_LAST) return null;
  return (COLOR_START[color] + position) % 52;
}

export function validPieceIndexes(pieces: LudoPieceSet, roll: number) {
  if (!Number.isInteger(roll) || roll < 1 || roll > 6) return [];
  return pieces.flatMap((position, index) => {
    if (position === LUDO_FINISH) return [];
    if (position === LUDO_BASE) return roll === 6 ? [index] : [];
    return position + roll <= LUDO_FINISH ? [index] : [];
  });
}

export function destinationForMove(position: number, roll: number) {
  if (position === LUDO_BASE) {
    if (roll !== 6) throw new Error("PIECE_NEEDS_SIX");
    return 0;
  }
  const destination = position + roll;
  if (destination > LUDO_FINISH) throw new Error("MOVE_OVERSHOOTS_FINISH");
  return destination;
}

export function applyLudoMove(players: LudoRulePlayer[], playerId: string, pieceIndex: number, roll: number) {
  const actor = players.find(player => player.id === playerId);
  if (!actor) throw new Error("PLAYER_NOT_FOUND");
  if (!validPieceIndexes(actor.pieces, roll).includes(pieceIndex)) throw new Error("INVALID_PIECE_MOVE");
  const from = actor.pieces[pieceIndex];
  const to = destinationForMove(from, roll);
  const blockedSquares = new Set<number>();
  for (const opponent of players.filter(player => player.id !== actor.id)) {
    const counts = new Map<number, number>();
    for (const position of opponent.pieces) {
      const square = globalTrackSquare(opponent.color, position);
      if (square !== null) counts.set(square, (counts.get(square) ?? 0) + 1);
    }
    for (const [square, count] of counts) if (count >= 2) blockedSquares.add(square);
  }
  const path: number[] = [];
  if (from === LUDO_BASE) path.push(COLOR_START[actor.color]);
  else for (let position = from + 1; position <= Math.min(to, LUDO_TRACK_LAST); position += 1) path.push(globalTrackSquare(actor.color, position)!);
  if (path.some(square => blockedSquares.has(square))) throw new Error("INVALID_PIECE_MOVE");
  actor.pieces[pieceIndex] = to;

  const captured: Array<{ playerId: string; pieceIndex: number }> = [];
  const square = globalTrackSquare(actor.color, to);
  if (square !== null && !SAFE_GLOBAL_SQUARES.has(square)) {
    for (const opponent of players) {
      if (opponent.id === actor.id) continue;
      opponent.pieces.forEach((position, opponentPieceIndex) => {
        if (globalTrackSquare(opponent.color, position) === square) {
          opponent.pieces[opponentPieceIndex] = LUDO_BASE;
          captured.push({ playerId: opponent.id, pieceIndex: opponentPieceIndex });
        }
      });
    }
  }

  const finished = actor.pieces.every(position => position === LUDO_FINISH);
  return { from, to, captured, finished, extraTurn: roll === 6 || captured.length > 0 || to === LUDO_FINISH };
}

export function validPieceIndexesForPlayer(players: LudoRulePlayer[], playerId: string, roll: number) {
  const actor = players.find(player => player.id === playerId);
  if (!actor) return [];
  return validPieceIndexes(actor.pieces, roll).filter(pieceIndex => {
    const clone = players.map(player => ({ ...player, pieces: [...player.pieces] as LudoPieceSet }));
    try { applyLudoMove(clone, playerId, pieceIndex, roll); return true; } catch { return false; }
  });
}

export function chooseAutomaticPiece(players: LudoRulePlayer[], playerId: string, roll: number, random = Math.random) {
  const actor = players.find(player => player.id === playerId);
  if (!actor) throw new Error("PLAYER_NOT_FOUND");
  const options = validPieceIndexesForPlayer(players, playerId, roll);
  if (!options.length) return null;
  return options[Math.floor(random() * options.length)] ?? options[0];
}

export function chooseProfessorBotPiece(players: LudoRulePlayer[], playerId: string, roll: number) {
  const actor = players.find(player => player.id === playerId);
  if (!actor) throw new Error("PLAYER_NOT_FOUND");
  const options = validPieceIndexesForPlayer(players, playerId, roll);
  if (!options.length) return null;
  return options
    .map(pieceIndex => {
      const clone = players.map(player => ({ ...player, pieces: [...player.pieces] as LudoPieceSet }));
      const result = applyLudoMove(clone, playerId, pieceIndex, roll);
      const score = (result.finished ? 10_000 : 0) + result.captured.length * 1_000 + (result.to === LUDO_FINISH ? 500 : 0) + (result.from === LUDO_BASE ? 100 : 0) + result.to;
      return { pieceIndex, score };
    })
    .sort((left, right) => right.score - left.score || left.pieceIndex - right.pieceIndex)[0].pieceIndex;
}

export function rollFair(random = Math.random) {
  return Math.floor(random() * 6) + 1;
}

export function rollForProfessorBot(players: LudoRulePlayer[], playerId: string, random = Math.random, advantaged = true) {
  if (random() >= 0.9) return rollFair(random);
  const actor = players.find(player => player.id === playerId);
  if (!actor) throw new Error("PLAYER_NOT_FOUND");
  const ranked = [1, 2, 3, 4, 5, 6]
    .map(roll => {
      const pieceIndex = chooseProfessorBotPiece(players, playerId, roll);
      if (pieceIndex === null) return { roll, score: -1 };
      const clone = players.map(player => ({ ...player, pieces: [...player.pieces] as LudoPieceSet }));
      const result = applyLudoMove(clone, playerId, pieceIndex, roll);
      const score = (result.finished ? 10_000 : 0) + result.captured.length * 1_000 + (result.to === LUDO_FINISH ? 500 : 0) + (roll === 6 ? 120 : 0) + result.to;
      return { roll, score };
    })
    .sort((left, right) => right.score - left.score || right.roll - left.roll);
  return advantaged ? ranked[0].roll : ranked[ranked.length - 1].roll;
}

export function ludoPayouts(totalPot: number, players: number) {
  if (!Number.isInteger(totalPot) || totalPot < 0 || players < 2 || players > 4) throw new Error("INVALID_LUDO_POT");
  const first = Math.floor(totalPot * (players === 2 ? 0.8 : 0.6));
  const second = players >= 3 ? Math.floor(totalPot * 0.2) : 0;
  return { first, second, treasury: totalPot - first - second };
}

export function ludoPlacementXp(position: number, playerCount: number) {
  if (position === playerCount) return -100;
  if (playerCount === 4 && position === 3) return 50;
  return 0;
}
