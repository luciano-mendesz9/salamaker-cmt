export const INVESTMENT_BLOCK_SIZE = 1_000;
export const MAX_DAILY_INVESTMENT = 3_000;
export const XP_FEE_PERCENT_PER_BLOCK = 5;
export const MAX_YIELD_WEEKS = 8;
export const WEEK_MS = 7 * 24 * 60 * 60 * 1_000;

export const INVESTMENT_PRODUCTS = [
  { key: "MAKER_SAVINGS", name: "Cofrinho Maker", minimumWeeks: 1, weeklyRateBps: 500 },
  { key: "MAKER_BOND", name: "Título Maker", minimumWeeks: 2, weeklyRateBps: 600 },
  { key: "MAKER_BOND_PLUS", name: "Título Maker+", minimumWeeks: 4, weeklyRateBps: 800 },
] as const;

export type InvestmentProductKey = (typeof INVESTMENT_PRODUCTS)[number]["key"];

export function getInvestmentProduct(key: InvestmentProductKey) {
  const product = INVESTMENT_PRODUCTS.find((item) => item.key === key);
  if (!product) throw new Error("INVALID_INVESTMENT_PRODUCT");
  return product;
}

export function isValidInvestmentAmount(product: InvestmentProductKey, amount: number) {
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > MAX_DAILY_INVESTMENT) return false;
  if (product === "MAKER_SAVINGS") return amount <= INVESTMENT_BLOCK_SIZE;
  return amount >= INVESTMENT_BLOCK_SIZE && amount % INVESTMENT_BLOCK_SIZE === 0;
}

export function assertInvestmentAmount(product: InvestmentProductKey, amount: number) {
  if (!isValidInvestmentAmount(product, amount)) throw new Error("INVALID_INVESTMENT_AMOUNT");
}

export function cumulativeXpFee(xpBase: number, totalAmount: number) {
  if (!Number.isSafeInteger(xpBase) || xpBase < 0) throw new Error("INVALID_XP_BASE");
  if (!Number.isSafeInteger(totalAmount) || totalAmount < 1 || totalAmount > MAX_DAILY_INVESTMENT) throw new Error("INVALID_INVESTMENT_AMOUNT");
  return Math.ceil((xpBase * XP_FEE_PERCENT_PER_BLOCK * totalAmount) / (100 * INVESTMENT_BLOCK_SIZE));
}

export function xpFeeForApplication(xpBase: number, investedToday: number, xpFeePaidToday: number, amount: number) {
  if (!Number.isSafeInteger(investedToday) || investedToday < 0) throw new Error("INVALID_DAILY_INVESTMENT");
  if (!Number.isSafeInteger(xpFeePaidToday) || xpFeePaidToday < 0) throw new Error("INVALID_DAILY_XP_FEE");
  if (!Number.isSafeInteger(amount) || amount < 1) throw new Error("INVALID_INVESTMENT_AMOUNT");
  const total = investedToday + amount;
  if (total > MAX_DAILY_INVESTMENT) throw new Error("DAILY_INVESTMENT_LIMIT");
  return cumulativeXpFee(xpBase, total) - xpFeePaidToday;
}

function pow(base: bigint, exponent: number) {
  let result = BigInt(1);
  for (let index = 0; index < exponent; index += 1) result *= base;
  return result;
}

export function compoundAmount(principal: number, weeklyRateBps: number, weeks: number, rounding: "floor" | "ceil" = "floor") {
  if (!Number.isSafeInteger(principal) || principal < 0) throw new Error("INVALID_PRINCIPAL");
  if (!Number.isSafeInteger(weeklyRateBps) || weeklyRateBps < 0) throw new Error("INVALID_WEEKLY_RATE");
  if (!Number.isSafeInteger(weeks) || weeks < 0 || weeks > MAX_YIELD_WEEKS) throw new Error("INVALID_WEEK_COUNT");
  const denominator = pow(BigInt(10_000), weeks);
  const numerator = BigInt(principal) * pow(BigInt(10_000 + weeklyRateBps), weeks);
  const value = rounding === "ceil" ? (numerator + denominator - BigInt(1)) / denominator : numerator / denominator;
  const numberValue = Number(value);
  if (!Number.isSafeInteger(numberValue)) throw new Error("INVESTMENT_VALUE_OVERFLOW");
  return numberValue;
}

export function completedInvestmentWeeks(appliedAt: Date, yieldEndsAt: Date, observedAt = new Date()) {
  const effectiveAt = Math.min(observedAt.getTime(), yieldEndsAt.getTime());
  return Math.max(0, Math.min(MAX_YIELD_WEEKS, Math.floor((effectiveAt - appliedAt.getTime()) / WEEK_MS)));
}

export function investmentValueAt(position: { principal: number; weeklyRateBps: number; appliedAt: Date; yieldEndsAt: Date }, observedAt = new Date()) {
  const weeks = completedInvestmentWeeks(position.appliedAt, position.yieldEndsAt, observedAt);
  const value = compoundAmount(position.principal, position.weeklyRateBps, weeks);
  return { weeks, value, dividends: value - position.principal };
}

export function maximumInvestmentPayout(principal: number, weeklyRateBps: number) {
  return compoundAmount(principal, weeklyRateBps, MAX_YIELD_WEEKS, "ceil");
}

export function requiredGuarantee(maximumPayoutLiability: number, coverageBps: number) {
  if (!Number.isSafeInteger(maximumPayoutLiability) || maximumPayoutLiability < 0) throw new Error("INVALID_LIABILITY");
  if (!Number.isSafeInteger(coverageBps) || coverageBps < 10_000) throw new Error("INVALID_COVERAGE");
  return Math.ceil((maximumPayoutLiability * coverageBps) / 10_000);
}

export function investmentDates(appliedAt: Date, minimumWeeks: number) {
  return {
    unlockAt: new Date(appliedAt.getTime() + minimumWeeks * WEEK_MS),
    yieldEndsAt: new Date(appliedAt.getTime() + MAX_YIELD_WEEKS * WEEK_MS),
  };
}
