import test from "node:test";
import assert from "node:assert/strict";
import { assetSlugFromName, isSafeAssetSlug, marketSplit, nextAvailableAssetSlug, stickerPriceRange, stickerRarity, stickerScore, suggestedPatentLevels } from "./stickers";
import { remainingWeeklyDevCoinTransfer } from "./dev-coins";

test("rarity and score follow the published copy bands", () => {
  assert.deepEqual([stickerRarity(30), stickerRarity(100), stickerRarity(101), stickerRarity(250), stickerRarity(251)], ["HIGH", "HIGH", "MEDIUM", "MEDIUM", "LOW"]);
  assert.deepEqual([stickerScore(500), stickerScore(200), stickerScore(60), stickerScore(30)], [6, 15, 50, 100]);
  assert.throws(() => stickerScore(29), /INVALID_TOTAL_COPIES/);
});

test("market fee conserves the price and ranges match rarity", () => {
  assert.deepEqual(marketSplit(11), { sellerAmount: 9, fee: 2 });
  assert.deepEqual(stickerPriceRange("LOW"), { min: 5, max: 60 });
  assert.deepEqual(stickerPriceRange("HIGH"), { min: 20, max: 300 });
});

test("patent configuration has 23 permanent levels", () => {
  const levels = suggestedPatentLevels(2_000);
  assert.equal(levels.length, 23);
  assert.equal(levels[0].name, "Bronze I");
  assert.equal(levels[0].threshold, 0);
  assert.deepEqual(levels.at(-1), { rank: 23, name: "Super Dev", threshold: 2_000, xpReward: 50, devCoinReward: 100, packReward: 0 });
});

test("asset slugs cannot escape allowlisted directories", () => {
  assert.equal(isSafeAssetSlug("robo-explorador"), true);
  for (const value of ["../segredo", "com/barra", "a", "-inicio", "fim-", "NOME"]) assert.equal(isSafeAssetSlug(value), false);
});

test("asset identifiers are generated safely and avoid collisions", () => {
  assert.equal(assetSlugFromName("Robô Explorador"), "robo-explorador");
  assert.equal(nextAvailableAssetSlug("Robô Explorador", ["robo-explorador", "robo-explorador-2"]), "robo-explorador-3");
  assert.throws(() => assetSlugFromName("--"), /INVALID_GENERATED_SLUG/);
});

test("weekly transfer allowance never becomes negative", () => {
  assert.equal(remainingWeeklyDevCoinTransfer(0), 300);
  assert.equal(remainingWeeklyDevCoinTransfer(125), 175);
  assert.equal(remainingWeeklyDevCoinTransfer(300), 0);
  assert.equal(remainingWeeklyDevCoinTransfer(450), 0);
});
