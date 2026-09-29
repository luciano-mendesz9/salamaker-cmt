export const DEFAULT_DEV_COINS_PER_XP = 1;
export const INITIAL_DEV_COIN_GRANT = 25;
export const DEV_COIN_TRANSFER_XP_FEE = 5;
export const WEEKLY_DEV_COIN_TRANSFER_LIMIT = 300;

export function devCoinsForXp(xpAmount: number, devCoinsPerXp: number) {
  if (!Number.isInteger(xpAmount) || xpAmount < 1) throw new Error("INVALID_XP_AMOUNT");
  if (!Number.isInteger(devCoinsPerXp) || devCoinsPerXp < 1) throw new Error("INVALID_DEV_COIN_RATE");
  return xpAmount * devCoinsPerXp;
}

export function remainingWeeklyDevCoinTransfer(sentAmount: number) {
  if (!Number.isInteger(sentAmount) || sentAmount < 0) throw new Error("INVALID_TRANSFER_TOTAL");
  return Math.max(0, WEEKLY_DEV_COIN_TRANSFER_LIMIT - sentAmount);
}
