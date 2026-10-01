import assert from "node:assert/strict";
import test from "node:test";
import { applyLudoMove, globalTrackSquare, ludoPayouts, ludoPlacementXp, parsePieces, rollForProfessorBot, validPieceIndexes, validPieceIndexesForPlayer } from "./ludo-rules";

test("uma peça só sai da base ao sortear seis", () => {
  assert.deepEqual(validPieceIndexes([-1, -1, -1, -1], 5), []);
  assert.deepEqual(validPieceIndexes([-1, -1, -1, -1], 6), [0, 1, 2, 3]);
});

test("a chegada precisa ser exata", () => {
  assert.deepEqual(validPieceIndexes([55, 57, -1, -1], 2), [0]);
  assert.deepEqual(validPieceIndexes([56, 57, -1, -1], 2), []);
});

test("captura devolve a peça adversária à base fora de casa segura", () => {
  const players = [
    { id: "red", color: "RED" as const, pieces: [4, -1, -1, -1] as [number, number, number, number] },
    { id: "green", color: "GREEN" as const, pieces: [44, -1, -1, -1] as [number, number, number, number] },
  ];
  assert.equal(globalTrackSquare("RED", 5), globalTrackSquare("GREEN", 44));
  const result = applyLudoMove(players, "red", 0, 1);
  assert.equal(players[1].pieces[0], -1);
  assert.equal(result.captured.length, 1);
  assert.equal(result.extraTurn, true);
});

test("posição segura não permite captura", () => {
  const players = [
    { id: "red", color: "RED" as const, pieces: [-1, -1, -1, -1] as [number, number, number, number] },
    { id: "green", color: "GREEN" as const, pieces: [39, -1, -1, -1] as [number, number, number, number] },
  ];
  applyLudoMove(players, "red", 0, 6);
  assert.equal(players[1].pieces[0], 39);
});

test("duas peças adversárias formam um bloqueio que não pode ser atravessado", () => {
  const players = [
    { id: "red", color: "RED" as const, pieces: [4, -1, -1, -1] as [number, number, number, number] },
    { id: "green", color: "GREEN" as const, pieces: [45, 45, -1, -1] as [number, number, number, number] },
  ];
  assert.deepEqual(validPieceIndexesForPlayer(players, "red", 2), []);
  assert.throws(() => applyLudoMove(players, "red", 0, 2), /INVALID_PIECE_MOVE/);
});

test("rateio preserva todo o pote e arredonda para o caixa", () => {
  assert.deepEqual(ludoPayouts(40, 2), { first: 32, second: 0, treasury: 8 });
  assert.deepEqual(ludoPayouts(90, 3), { first: 54, second: 18, treasury: 18 });
  assert.deepEqual(ludoPayouts(44, 4), { first: 26, second: 8, treasury: 10 });
});

test("XP por colocação segue as regras de dois, três e quatro jogadores", () => {
  assert.equal(ludoPlacementXp(2, 2), -100);
  assert.equal(ludoPlacementXp(3, 3), -100);
  assert.equal(ludoPlacementXp(3, 4), 50);
  assert.equal(ludoPlacementXp(4, 4), -100);
  assert.equal(ludoPlacementXp(2, 4), 0);
});

test("estado de peças rejeita dados corrompidos", () => {
  assert.throws(() => parsePieces([1, 2, 3]), /INVALID_LUDO_PIECES/);
  assert.deepEqual(parsePieces([-1, 0, 20, 57]), [-1, 0, 20, 57]);
});

test("perfil da IA escolhe o melhor ou pior sorteio sem afetar o dado humano", () => {
  const players = [{ id: "bot", color: "GREEN" as const, pieces: [-1, -1, -1, -1] as [number, number, number, number] }];
  assert.equal(rollForProfessorBot(players, "bot", () => 0, true), 6);
  assert.equal(rollForProfessorBot(players, "bot", () => 0, false), 1);
});
