import "server-only";
import { prisma } from "@/lib/db";
import { getSchoolDay } from "@/lib/school-day";
import { creditTreasury } from "@/lib/treasury";
import {
  assertInvestmentAmount,
  getInvestmentProduct,
  investmentDates,
  investmentValueAt,
  INVESTMENT_BLOCK_SIZE,
  INVESTMENT_PRODUCTS,
  MAX_DAILY_INVESTMENT,
  maximumInvestmentPayout,
  requiredGuarantee,
  xpFeeForApplication,
  type InvestmentProductKey,
} from "@/lib/investment-rules";

export class InvestmentConflict extends Error {
  constructor(message: string, public readonly current?: number) { super(message); }
}

type ApplyInput = { studentId: string; product: InvestmentProductKey; amount: number; requestId: string; now?: Date };
type RedeemInput = { studentId: string; positionId: string; requestId: string; now?: Date };

function maximumLiability(positions: Array<{ principal: number; weeklyRateBps: number }>) {
  return positions.reduce((total, position) => total + maximumInvestmentPayout(position.principal, position.weeklyRateBps), 0);
}

async function retrySerializable<T>(work: () => Promise<T>) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try { return await work(); } catch (error) {
      const code = (error as { code?: string }).code;
      if ((code === "P2034" || code === "P2002") && attempt < 2) continue;
      throw error;
    }
  }
  throw new Error("TRANSACTION_RETRY_EXHAUSTED");
}

export async function applyInvestment(input: ApplyInput) {
  const now = input.now ?? new Date();
  const product = getInvestmentProduct(input.product);
  assertInvestmentAmount(input.product, input.amount);
  return retrySerializable(() => prisma.$transaction(async (tx) => {
    const duplicate = await tx.investmentTransaction.findUnique({
      where: { requestId: input.requestId },
      include: { position: true },
    });
    if (duplicate) {
      if (duplicate.studentId !== input.studentId || duplicate.type !== "APPLICATION") throw new InvestmentConflict("REQUEST_ID_CONFLICT");
      const student = await tx.user.findUniqueOrThrow({ where: { id: input.studentId }, select: { xp: true, devCoins: true } });
      return { position: duplicate.position, xp: student.xp, devCoins: student.devCoins, idempotent: true };
    }

    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${input.studentId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "DevCoinTreasury" WHERE "id" = 1 FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "InvestmentFund" WHERE "id" = 1 FOR UPDATE`;
    const [student, settings, fund, activePositions] = await Promise.all([
      tx.user.findFirstOrThrow({ where: { id: input.studentId, role: "STUDENT", status: "ACTIVE" }, select: { xp: true, devCoins: true } }),
      tx.appSetting.findUnique({ where: { id: 1 }, select: { timeZone: true } }),
      tx.investmentFund.findUniqueOrThrow({ where: { id: 1 } }),
      tx.investmentPosition.findMany({ where: { status: "ACTIVE" }, select: { principal: true, weeklyRateBps: true } }),
    ]);
    const applicationDay = getSchoolDay(now, settings?.timeZone).key;
    const today = await tx.investmentPosition.findMany({
      where: { studentId: input.studentId, applicationDay },
      select: { principal: true, xpBase: true, xpFee: true },
      orderBy: { appliedAt: "asc" },
    });
    const investedToday = today.reduce((total, position) => total + position.principal, 0);
    const xpFeePaidToday = today.reduce((total, position) => total + position.xpFee, 0);
    const xpBase = today[0]?.xpBase ?? student.xp;
    const xpFee = xpFeeForApplication(xpBase, investedToday, xpFeePaidToday, input.amount);
    if (student.devCoins < input.amount) throw new InvestmentConflict("INSUFFICIENT_DEV_COINS", student.devCoins);
    if (student.xp < xpFee) throw new InvestmentConflict("INSUFFICIENT_XP", student.xp);

    const liabilityAfter = maximumLiability(activePositions) + maximumInvestmentPayout(input.amount, product.weeklyRateBps);
    const requiredAfter = requiredGuarantee(liabilityAfter, fund.coverageBps);
    if (requiredAfter > fund.balance) throw new InvestmentConflict("INSUFFICIENT_INVESTMENT_CAPACITY", Math.max(0, fund.balance - requiredGuarantee(maximumLiability(activePositions), fund.coverageBps)));

    const changed = await tx.user.updateMany({
      where: { id: input.studentId, role: "STUDENT", status: "ACTIVE", devCoins: { gte: input.amount }, xp: { gte: xpFee } },
      data: { devCoins: { decrement: input.amount }, xp: { decrement: xpFee } },
    });
    if (changed.count !== 1) throw new InvestmentConflict("BALANCE_CHANGED");

    const reason = `Aplicação de ${input.amount} DC no ${product.name}`;
    const feeXpEntry = xpFee > 0 ? await tx.xpEntry.create({
      data: { studentId: input.studentId, delta: -xpFee, reason: `Taxa de investimento: ${product.name}`, source: "INVESTMENT_FEE", idempotencyKey: `investment:xp:${input.requestId}` },
    }) : null;
    const devCoinEntry = await tx.devCoinEntry.create({
      data: { studentId: input.studentId, delta: -input.amount, reason, source: "INVESTMENT_APPLICATION", idempotencyKey: `investment:devcoin:${input.requestId}` },
    });
    await creditTreasury(tx, input.amount, { reason, source: "INVESTMENT_APPLICATION", idempotencyKey: `treasury:investment:${input.requestId}`, devCoinEntryId: devCoinEntry.id });
    const dates = investmentDates(now, product.minimumWeeks);
    const position = await tx.investmentPosition.create({
      data: {
        studentId: input.studentId,
        product: input.product,
        principal: input.amount,
        weeklyRateBps: product.weeklyRateBps,
        xpBase,
        xpFee,
        applicationDay,
        appliedAt: now,
        unlockAt: dates.unlockAt,
        yieldEndsAt: dates.yieldEndsAt,
        feeXpEntryId: feeXpEntry?.id,
      },
    });
    await tx.investmentTransaction.create({
      data: { positionId: position.id, studentId: input.studentId, type: "APPLICATION", principalAmount: input.amount, devCoinEntryId: devCoinEntry.id, requestId: input.requestId, createdAt: now },
    });
    await tx.auditLog.create({ data: { actorId: input.studentId, targetId: input.studentId, event: "INVESTMENT_APPLIED", details: { positionId: position.id, product: input.product, principal: input.amount, weeklyRateBps: product.weeklyRateBps, xpBase, xpFee, unlockAt: dates.unlockAt, yieldEndsAt: dates.yieldEndsAt, liabilityAfter, requiredAfter } } });
    return { position, xp: student.xp - xpFee, devCoins: student.devCoins - input.amount, idempotent: false };
  }, { isolationLevel: "Serializable", maxWait: 10_000, timeout: 20_000 }));
}

export async function redeemInvestment(input: RedeemInput) {
  const now = input.now ?? new Date();
  return retrySerializable(() => prisma.$transaction(async (tx) => {
    const duplicate = await tx.investmentTransaction.findUnique({ where: { requestId: input.requestId }, include: { position: true } });
    if (duplicate) {
      if (duplicate.studentId !== input.studentId || duplicate.type !== "REDEMPTION") throw new InvestmentConflict("REQUEST_ID_CONFLICT");
      const student = await tx.user.findUniqueOrThrow({ where: { id: input.studentId }, select: { devCoins: true } });
      return { payout: duplicate.principalAmount + duplicate.dividendAmount, dividends: duplicate.dividendAmount, devCoins: student.devCoins, position: duplicate.position, idempotent: true };
    }

    await tx.$queryRaw`SELECT "id" FROM "InvestmentPosition" WHERE "id" = ${input.positionId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${input.studentId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "DevCoinTreasury" WHERE "id" = 1 FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "InvestmentFund" WHERE "id" = 1 FOR UPDATE`;
    const [position, student, treasury, fund] = await Promise.all([
      tx.investmentPosition.findFirstOrThrow({ where: { id: input.positionId, studentId: input.studentId } }),
      tx.user.findFirstOrThrow({ where: { id: input.studentId, role: "STUDENT", status: "ACTIVE" }, select: { devCoins: true } }),
      tx.devCoinTreasury.findUniqueOrThrow({ where: { id: 1 } }),
      tx.investmentFund.findUniqueOrThrow({ where: { id: 1 } }),
    ]);
    if (position.status !== "ACTIVE") throw new InvestmentConflict("INVESTMENT_ALREADY_REDEEMED");
    if (now < position.unlockAt) throw new InvestmentConflict("INVESTMENT_LOCKED", position.unlockAt.getTime());
    const accrued = investmentValueAt(position, now);
    const payout = accrued.value;
    const treasuryAmount = Math.min(treasury.balance, payout);
    const reserveAmount = payout - treasuryAmount;
    if (fund.balance < reserveAmount) throw new InvestmentConflict("INSUFFICIENT_REDEMPTION_GUARANTEE", fund.balance);

    await tx.user.update({ where: { id: input.studentId }, data: { devCoins: { increment: payout } } });
    const devCoinEntry = await tx.devCoinEntry.create({
      data: { studentId: input.studentId, delta: payout, reason: `Resgate de investimento: ${position.principal} DC + ${accrued.dividends} DC`, source: "INVESTMENT_REDEMPTION", idempotencyKey: `investment:redemption:devcoin:${input.requestId}` },
    });
    if (treasuryAmount > 0) {
      await tx.devCoinTreasury.update({ where: { id: 1 }, data: { balance: { decrement: treasuryAmount } } });
      await tx.devCoinTreasuryEntry.create({ data: { delta: -treasuryAmount, reason: `Resgate do investimento ${position.id}`, source: "INVESTMENT_REDEMPTION", idempotencyKey: `treasury:investment-redemption:${input.requestId}`, devCoinEntryId: devCoinEntry.id } });
    }
    const transaction = await tx.investmentTransaction.create({
      data: { positionId: position.id, studentId: input.studentId, type: "REDEMPTION", principalAmount: position.principal, dividendAmount: accrued.dividends, devCoinEntryId: devCoinEntry.id, requestId: input.requestId, createdAt: now },
    });
    if (reserveAmount > 0) {
      await tx.investmentFund.update({ where: { id: 1 }, data: { balance: { decrement: reserveAmount } } });
      await tx.investmentReserveEntry.create({ data: { transactionId: transaction.id, delta: -reserveAmount, reason: `Cobertura do resgate ${position.id}`, source: "REDEMPTION_GUARANTEE", idempotencyKey: `investment-reserve:redemption:${input.requestId}` } });
    }
    const redeemed = await tx.investmentPosition.update({ where: { id: position.id }, data: { status: "REDEEMED", redeemedAt: now } });
    await tx.auditLog.create({ data: { actorId: input.studentId, targetId: input.studentId, event: "INVESTMENT_REDEEMED", details: { positionId: position.id, principal: position.principal, dividends: accrued.dividends, payout, completedWeeks: accrued.weeks, treasuryAmount, reserveAmount } } });
    return { payout, dividends: accrued.dividends, devCoins: student.devCoins + payout, position: redeemed, idempotent: false };
  }, { isolationLevel: "Serializable", maxWait: 10_000, timeout: 20_000 }));
}

function schoolDateKey(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function graphSeries(transactions: Array<{ type: "APPLICATION" | "REDEMPTION"; principalAmount: number; createdAt: Date }>, observedAt: Date, timeZone: string) {
  const totals = new Map<string, { applied: number; redeemed: number }>();
  for (const transaction of transactions) {
    const key = schoolDateKey(transaction.createdAt, timeZone);
    const current = totals.get(key) ?? { applied: 0, redeemed: 0 };
    if (transaction.type === "APPLICATION") current.applied += transaction.principalAmount;
    else current.redeemed += transaction.principalAmount;
    totals.set(key, current);
  }
  const endKey = schoolDateKey(observedAt, timeZone);
  const startKey = transactions[0] ? schoolDateKey(transactions[0].createdAt, timeZone) : endKey;
  const cursor = new Date(`${startKey}T00:00:00.000Z`);
  const end = new Date(`${endKey}T00:00:00.000Z`);
  const result: Array<{ date: string; applied: number; redeemed: number }> = [];
  let applied = 0;
  let redeemed = 0;
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10);
    const day = totals.get(key);
    applied += day?.applied ?? 0;
    redeemed += day?.redeemed ?? 0;
    result.push({ date: key, applied, redeemed });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

export async function getInvestmentPortfolio(studentId: string, observedAt = new Date()) {
  const [student, settings, fund, positions, transactions, allActive] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: studentId }, select: { xp: true, devCoins: true } }),
    prisma.appSetting.findUnique({ where: { id: 1 }, select: { timeZone: true } }),
    prisma.investmentFund.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.investmentPosition.findMany({ where: { studentId }, orderBy: { appliedAt: "desc" } }),
    prisma.investmentTransaction.findMany({ where: { studentId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    prisma.investmentPosition.findMany({ where: { status: "ACTIVE" }, select: { principal: true, weeklyRateBps: true } }),
  ]);
  const timeZone = settings?.timeZone ?? "America/Fortaleza";
  const dayKey = getSchoolDay(observedAt, timeZone).key;
  const today = positions.filter((position) => position.applicationDay === dayKey);
  const investedToday = today.reduce((total, position) => total + position.principal, 0);
  const xpFeePaidToday = today.reduce((total, position) => total + position.xpFee, 0);
  const xpBaseToday = today[0]?.xpBase ?? student.xp;
  const liability = maximumLiability(allActive);
  const required = requiredGuarantee(liability, fund.coverageBps);
  const active = positions.filter((position) => position.status === "ACTIVE").map((position) => ({
    id: position.id,
    product: position.product,
    principal: position.principal,
    weeklyRateBps: position.weeklyRateBps,
    xpFee: position.xpFee,
    appliedAt: position.appliedAt.toISOString(),
    unlockAt: position.unlockAt.toISOString(),
    yieldEndsAt: position.yieldEndsAt.toISOString(),
    ...investmentValueAt(position, observedAt),
  }));
  const history = transactions.slice().reverse().map((transaction) => ({
    id: transaction.id,
    type: transaction.type,
    principalAmount: transaction.principalAmount,
    dividendAmount: transaction.dividendAmount,
    createdAt: transaction.createdAt.toISOString(),
  }));
  return {
    observedAt: observedAt.toISOString(),
    xp: student.xp,
    devCoins: student.devCoins,
    products: INVESTMENT_PRODUCTS,
    dailyRemaining: Math.max(0, MAX_DAILY_INVESTMENT - investedToday),
    investedToday,
    xpBaseToday,
    xpFeePaidToday,
    fund: { balance: fund.balance, targetBalance: fund.targetBalance, coverageBps: fund.coverageBps, maximumPayoutLiability: liability, requiredGuarantee: required, availableGuarantee: Math.max(0, fund.balance - required) },
    active,
    history,
    graph: graphSeries(transactions, observedAt, timeZone),
    blockSize: INVESTMENT_BLOCK_SIZE,
  };
}
