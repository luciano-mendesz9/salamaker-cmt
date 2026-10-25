import assert from "node:assert/strict";
import test from "node:test";
import { adjustedXp, getDueXpAdjustmentPeriod, getXpAdjustmentAlert } from "./xp-adjustment-policy";

test("reajuste divide por dez, arredonda para cima e limita negativos a zero", () => {
  assert.equal(adjustedXp(100), 10);
  assert.equal(adjustedXp(93), 10);
  assert.equal(adjustedXp(1), 1);
  assert.equal(adjustedXp(0), 0);
  assert.equal(adjustedXp(-50), 0);
});

test("alerta começa no dia 25 à meia-noite de Fortaleza", () => {
  assert.equal(getXpAdjustmentAlert(new Date("2026-10-25T02:59:59Z")), null);
  assert.equal(getXpAdjustmentAlert(new Date("2026-10-25T03:00:00Z"))?.targetAt.toISOString(), "2026-11-01T09:00:00.000Z");
});

test("alerta continua até as 06h do dia primeiro e depois encerra", () => {
  assert.equal(getXpAdjustmentAlert(new Date("2026-11-01T08:59:59Z"))?.periodKey, "2026-11");
  assert.equal(getXpAdjustmentAlert(new Date("2026-11-01T09:00:00Z")), null);
});

test("execução só fica devida no dia primeiro a partir das 06h", () => {
  assert.equal(getDueXpAdjustmentPeriod(new Date("2026-11-01T08:59:59Z")), null);
  assert.equal(getDueXpAdjustmentPeriod(new Date("2026-11-01T09:00:00Z")), "2026-11");
  assert.equal(getDueXpAdjustmentPeriod(new Date("2026-11-02T09:00:00Z")), null);
});
