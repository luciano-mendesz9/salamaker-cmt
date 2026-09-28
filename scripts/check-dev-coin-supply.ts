import "dotenv/config";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import WebSocket from "ws";
import { PrismaClient } from "../src/generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL não configurada.");

neonConfig.webSocketConstructor = WebSocket;
const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: databaseUrl }),
});

async function main() {
  try {
    const [students, balances, ledger, schemaRows] = await Promise.all([
      prisma.user.count({ where: { role: "STUDENT" } }),
      prisma.user.aggregate({
        where: { role: "STUDENT" },
        _sum: { devCoins: true },
      }),
      prisma.devCoinEntry.aggregate({ _sum: { delta: true } }),
      prisma.$queryRawUnsafe<Array<{ sticker: string | null; treasury: string | null; marketSettings: string | null }>>(
        `SELECT to_regclass('public."Sticker"')::text AS "sticker", to_regclass('public."DevCoinTreasury"')::text AS "treasury", to_regclass('public."StickerMarketSetting"')::text AS "marketSettings"`,
      ),
    ]);

    const studentBalance = balances._sum.devCoins ?? 0;
    const ledgerBalance = ledger._sum.delta ?? 0;
    const collectiblesSchemaReady = Boolean(schemaRows[0]?.sticker && schemaRows[0]?.treasury && schemaRows[0]?.marketSettings);
    const marketSetting = collectiblesSchemaReady
      ? await prisma.stickerMarketSetting.findUnique({ where: { id: 1 }, select: { enabled: true } })
      : null;

    console.log(JSON.stringify({
      students,
      studentBalance,
      ledgerBalance,
      reconciled: studentBalance === ledgerBalance,
      requestedBase: 1_000,
      safetyReserve: 500,
      openingTreasuryBalance: 1_500,
      openingManagedSupply: 1_500 + studentBalance,
      collectiblesSchemaReady,
      stickerMarketEnabled: marketSetting?.enabled ?? null,
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

void main();
