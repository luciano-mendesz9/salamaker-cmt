export const DEFAULT_DEV_COINS_PER_XP = 1;
export const INITIAL_DEV_COIN_GRANT = 25;

export function devCoinsForXp(xpAmount: number, devCoinsPerXp: number) {
  if (!Number.isInteger(xpAmount) || xpAmount < 1) throw new Error("INVALID_XP_AMOUNT");
  if (!Number.isInteger(devCoinsPerXp) || devCoinsPerXp < 1) throw new Error("INVALID_DEV_COIN_RATE");
  return xpAmount * devCoinsPerXp;
}
