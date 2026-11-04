export const DEV_COIN_TO_XP_WINDOW_MS = 48 * 60 * 60 * 1_000;
export const DEV_COIN_TO_XP_LIMIT = 20;
export const DEV_COIN_TO_XP_MULTIPLIER = 10;

export function devCoinsRequiredForXp(xpAmount: number, devCoinsPerXp: number) {
  if (!Number.isInteger(xpAmount) || xpAmount < 1 || xpAmount > DEV_COIN_TO_XP_LIMIT) throw new Error("INVALID_XP_AMOUNT");
  if (!Number.isInteger(devCoinsPerXp) || devCoinsPerXp < 1 || devCoinsPerXp > 10_000) throw new Error("INVALID_DEV_COIN_RATE");
  return xpAmount * devCoinsPerXp * DEV_COIN_TO_XP_MULTIPLIER;
}

export function devCoinToXpQuota(entries: { delta: number; createdAt: Date }[], now: Date) {
  const cutoff = now.getTime() - DEV_COIN_TO_XP_WINDOW_MS;
  const active = entries.filter(entry => entry.createdAt.getTime() > cutoff).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const used = active.reduce((total, entry) => total + entry.delta, 0);
  return {
    used,
    remaining: Math.max(0, DEV_COIN_TO_XP_LIMIT - used),
    nextAvailableAt: active[0] ? new Date(active[0].createdAt.getTime() + DEV_COIN_TO_XP_WINDOW_MS).toISOString() : null,
  };
}
