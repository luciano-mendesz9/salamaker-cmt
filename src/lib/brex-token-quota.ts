export const BREX_TOKEN_BALANCE_LIMIT = 10_000;
export const BREX_TOKEN_COOLDOWN_MS = 30 * 60 * 1000;

export function currentBrexQuota(account: { usedTokens: number; exhaustedAt: Date | null } | null, now = new Date()) {
  const refreshAt = account?.exhaustedAt ? new Date(account.exhaustedAt.getTime() + BREX_TOKEN_COOLDOWN_MS) : null;
  const refreshed = refreshAt !== null && refreshAt <= now;
  const used = refreshed ? 0 : Math.min(BREX_TOKEN_BALANCE_LIMIT, account?.usedTokens ?? 0);
  return { limit: BREX_TOKEN_BALANCE_LIMIT, used, remaining: BREX_TOKEN_BALANCE_LIMIT - used, refreshAt: refreshed ? null : refreshAt?.toISOString() ?? null, checkedAt: now.toISOString() };
}

export function debitBrexQuota(quota: ReturnType<typeof currentBrexQuota>, actualTokens: number, now = new Date()) {
  if (!Number.isSafeInteger(actualTokens) || actualTokens < 0 || quota.remaining <= 0) throw new Error("BREX_QUOTA_EXHAUSTED");
  const chargedTokens = Math.min(quota.remaining, actualTokens);
  const usedTokens = quota.used + chargedTokens;
  const exhaustedAt = usedTokens >= quota.limit ? now : null;
  return { chargedTokens, usedTokens, exhaustedAt, quota: currentBrexQuota({ usedTokens, exhaustedAt }, now) };
}
