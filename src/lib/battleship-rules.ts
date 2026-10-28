export const BATTLESHIP_BOARD_SIZE = 10;
export const BATTLESHIP_CELL_COUNT = 100;
export const BATTLESHIP_MIN_WAGER = 10;
export const BATTLESHIP_MAX_WAGER = 500;
export const BATTLESHIP_WAGER_STEP = 5;
export const BATTLESHIP_TAX_PERCENT = 20;
export const BATTLESHIP_HIT_XP_PENALTY = 10;
export const BATTLESHIP_SINK_XP_REWARD = 50;
export const BATTLESHIP_SINK_XP_PENALTY = 30;
export const BATTLESHIP_DAILY_MATCH_LIMIT = 9;
export const BATTLESHIP_DAILY_OPPONENT_LIMIT = 3;

export type BattleshipShip = {
  id: string;
  kind: "carrier" | "battleship" | "cruiser" | "submarine" | "destroyer";
  label: string;
  length: number;
  cells: number[];
  hits: number[];
};

export const BATTLESHIP_FLEET = [
  { id: "carrier", kind: "carrier", label: "Porta-aviões", length: 5 },
  { id: "battleship", kind: "battleship", label: "Encouraçado", length: 4 },
  { id: "cruiser", kind: "cruiser", label: "Cruzador", length: 3 },
  { id: "submarine", kind: "submarine", label: "Submarino", length: 3 },
  { id: "destroyer", kind: "destroyer", label: "Contratorpedeiro", length: 2 },
] as const;

function randomIndex(max: number, random: () => number) {
  return Math.floor(Math.min(Math.max(random(), 0), 0.999999999) * max);
}

export function generateBattleshipFleet(random: () => number = Math.random): BattleshipShip[] {
  const occupied = new Set<number>();
  return BATTLESHIP_FLEET.map((spec) => {
    for (let attempt = 0; attempt < 1_000; attempt += 1) {
      const horizontal = random() < 0.5;
      const row = randomIndex(horizontal ? BATTLESHIP_BOARD_SIZE : BATTLESHIP_BOARD_SIZE - spec.length + 1, random);
      const column = randomIndex(horizontal ? BATTLESHIP_BOARD_SIZE - spec.length + 1 : BATTLESHIP_BOARD_SIZE, random);
      const cells = Array.from({ length: spec.length }, (_, offset) => (row + (horizontal ? 0 : offset)) * BATTLESHIP_BOARD_SIZE + column + (horizontal ? offset : 0));
      if (cells.some((cell) => occupied.has(cell))) continue;
      cells.forEach((cell) => occupied.add(cell));
      return { ...spec, cells, hits: [] };
    }
    throw new Error("FLEET_PLACEMENT_FAILED");
  });
}

export function parseBattleshipFleet(value: unknown): BattleshipShip[] {
  if (!Array.isArray(value) || value.length !== BATTLESHIP_FLEET.length) throw new Error("INVALID_FLEET");
  const fleet = value as BattleshipShip[];
  const cells = fleet.flatMap((ship) => ship.cells);
  if (new Set(cells).size !== 17 || cells.some((cell) => !Number.isInteger(cell) || cell < 0 || cell >= BATTLESHIP_CELL_COUNT)) throw new Error("INVALID_FLEET");
  for (const spec of BATTLESHIP_FLEET) {
    const ship = fleet.find((item) => item.id === spec.id);
    if (!ship || ship.kind !== spec.kind || ship.length !== spec.length || ship.cells.length !== spec.length || !Array.isArray(ship.hits) || ship.hits.some((cell) => !ship.cells.includes(cell))) throw new Error("INVALID_FLEET");
  }
  return fleet.map((ship) => ({ ...ship, cells: [...ship.cells], hits: [...ship.hits] }));
}

export function fireAtFleet(fleetValue: unknown, cell: number) {
  if (!Number.isInteger(cell) || cell < 0 || cell >= BATTLESHIP_CELL_COUNT) throw new Error("INVALID_CELL");
  const fleet = parseBattleshipFleet(fleetValue);
  const ship = fleet.find((item) => item.cells.includes(cell));
  if (!ship) return { fleet, hit: false, sunkShip: null as BattleshipShip | null, allSunk: false };
  if (!ship.hits.includes(cell)) ship.hits.push(cell);
  const sunkShip = ship.cells.every((shipCell) => ship.hits.includes(shipCell)) ? ship : null;
  const allSunk = fleet.every((item) => item.cells.every((shipCell) => item.hits.includes(shipCell)));
  return { fleet, hit: true, sunkShip, allSunk };
}

export function battleshipSettlement(wager: number) {
  if (!Number.isInteger(wager) || wager < BATTLESHIP_MIN_WAGER || wager > BATTLESHIP_MAX_WAGER || wager % BATTLESHIP_WAGER_STEP !== 0) throw new Error("INVALID_WAGER");
  const total = wager * 2;
  const taxAmount = total * BATTLESHIP_TAX_PERCENT / 100;
  return { total, taxAmount, winnerPayout: total - taxAmount };
}

export function isBattleshipSunk(ship: Pick<BattleshipShip, "cells" | "hits">) {
  return ship.cells.every((cell) => ship.hits.includes(cell));
}
