import assert from "node:assert/strict";
import test from "node:test";
import { BATTLESHIP_DAILY_MATCH_LIMIT, BATTLESHIP_DAILY_OPPONENT_LIMIT, BATTLESHIP_HIT_XP_PENALTY, BATTLESHIP_SINK_XP_PENALTY, BATTLESHIP_SINK_XP_REWARD, battleshipSettlement, fireAtFleet, generateBattleshipFleet, isBattleshipSunk, parseBattleshipFleet } from "./battleship-rules";

function seededRandom(seed = 123456) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
}

test("gera a frota 5-4-3-3-2 sem sobreposição na grade 10x10", () => {
  const fleet = generateBattleshipFleet(seededRandom());
  assert.deepEqual(fleet.map((ship) => ship.length), [5, 4, 3, 3, 2]);
  assert.equal(new Set(fleet.flatMap((ship) => ship.cells)).size, 17);
  assert.equal(parseBattleshipFleet(fleet).length, 5);
});

test("tiro informa acerto, afundamento e fim da frota", () => {
  let fleet = generateBattleshipFleet(seededRandom(42));
  const target = fleet[4];
  let result = fireAtFleet(fleet, target.cells[0]);
  assert.equal(result.hit, true);
  assert.equal(result.sunkShip, null);
  result = fireAtFleet(result.fleet, target.cells[1]);
  assert.equal(result.sunkShip?.id, target.id);
  assert.equal(isBattleshipSunk(result.fleet[4]), true);
  fleet = result.fleet;
  for (const ship of fleet.slice(0, 4)) for (const cell of ship.cells) fleet = fireAtFleet(fleet, cell).fleet;
  assert.equal(fireAtFleet(fleet, fleet[0].cells[0]).allSunk, true);
});

test("liquidação envia 80% do pote ao vencedor e 20% ao caixa", () => {
  assert.deepEqual(battleshipSettlement(50), { total: 100, taxAmount: 20, winnerPayout: 80 });
  assert.throws(() => battleshipSettlement(12), /INVALID_WAGER/);
});

test("expõe os limites e efeitos de XP definidos para a batalha naval", () => {
  assert.equal(BATTLESHIP_DAILY_MATCH_LIMIT, 9);
  assert.equal(BATTLESHIP_DAILY_OPPONENT_LIMIT, 3);
  assert.equal(BATTLESHIP_HIT_XP_PENALTY, 10);
  assert.equal(BATTLESHIP_SINK_XP_REWARD, 50);
  assert.equal(BATTLESHIP_SINK_XP_PENALTY, 30);
});
