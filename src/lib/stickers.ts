export const STICKER_PACK_PRICE = 30;
export const STICKERS_PER_PACK = 3;
export const DAILY_STICKER_PACK_LIMIT = 5;

export type StickerRarityValue = "LOW" | "MEDIUM" | "HIGH";

export function stickerRarity(totalCopies: number): StickerRarityValue {
  if (!Number.isInteger(totalCopies) || totalCopies < 30) throw new Error("INVALID_TOTAL_COPIES");
  if (totalCopies <= 100) return "HIGH";
  if (totalCopies <= 250) return "MEDIUM";
  return "LOW";
}

export function stickerScore(totalCopies: number) {
  stickerRarity(totalCopies);
  return Math.ceil(3_000 / totalCopies);
}

export function stickerPriceRange(rarity: StickerRarityValue) {
  return rarity === "HIGH" ? { min: 20, max: 300 } : rarity === "MEDIUM" ? { min: 10, max: 150 } : { min: 5, max: 60 };
}

export function marketSplit(price: number) {
  if (!Number.isInteger(price) || price < 1) throw new Error("INVALID_PRICE");
  const sellerAmount = Math.floor(price * 0.9);
  return { sellerAmount, fee: price - sellerAmount };
}

export function isSafeAssetSlug(value: string) {
  return /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(value);
}

export const PATENT_NAMES = [
  "Bronze I", "Bronze II", "Bronze III",
  "Prata I", "Prata II", "Prata III",
  "Ouro I", "Ouro II", "Ouro III", "Ouro IV",
  "Platina I", "Platina II", "Platina III", "Platina IV",
  "Diamante I", "Diamante II", "Diamante III", "Diamante IV", "Diamante V",
  "Mestre I", "Mestre II", "Mestre III", "Super Dev",
] as const;

const PATENT_PERCENTAGES = [0, 2, 5, 8, 12, 16, 21, 26, 31, 36, 42, 48, 54, 60, 66, 71, 76, 81, 86, 90, 93, 96, 100] as const;

export function suggestedPatentLevels(maximumScore: number) {
  if (!Number.isInteger(maximumScore) || maximumScore < 1) throw new Error("INVALID_MAXIMUM_SCORE");
  let previous = -1;
  return PATENT_NAMES.map((name, index) => {
    const raw = index === 0 ? 0 : Math.ceil(maximumScore * PATENT_PERCENTAGES[index] / 100);
    const threshold = Math.max(raw, previous + 1);
    previous = threshold;
    const isSuperDev = index === PATENT_NAMES.length - 1;
    const bandChanged = index > 0 && name.split(" ")[0] !== PATENT_NAMES[index - 1].split(" ")[0];
    return {
      rank: index + 1,
      name,
      threshold: isSuperDev ? maximumScore : Math.min(threshold, maximumScore),
      xpReward: index === 0 ? 0 : isSuperDev ? 50 : bandChanged ? 25 : 10,
      devCoinReward: index === 0 ? 0 : isSuperDev ? 100 : bandChanged ? 40 : 15,
      packReward: index > 0 && bandChanged && !isSuperDev ? 1 : 0,
    };
  });
}
