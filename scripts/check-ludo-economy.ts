import "dotenv/config";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import WebSocket from "ws";
import { PrismaClient } from "../src/generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL não configurada.");
neonConfig.webSocketConstructor = WebSocket;
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: databaseUrl }) });

async function main() {
  try {
    const [schema] = await prisma.$queryRaw<Array<{ room: string | null; treasury: string | null }>>`
      SELECT to_regclass('public."LudoRoom"')::text AS "room", to_regclass('public."DevCoinTreasury"')::text AS "treasury"
    `;
    if (!schema?.room || !schema.treasury) {
      console.log(JSON.stringify({ ludoSchemaReady: false, message: "A migration do Ludo Maker ainda não está aplicada." }, null, 2));
      return;
    }
    const [students, studentLedger, treasury, treasuryLedger, rooms] = await Promise.all([
      prisma.user.aggregate({ where: { role: "STUDENT" }, _sum: { devCoins: true } }),
      prisma.devCoinEntry.aggregate({ _sum: { delta: true } }),
      prisma.devCoinTreasury.findUnique({ where: { id: 1 }, select: { balance: true, totalSupply: true } }),
      prisma.devCoinTreasuryEntry.aggregate({ _sum: { delta: true } }),
      prisma.$queryRaw<Array<{ id: string; code: string; escrow: number; stakes: number }>>`
        SELECT r."id", r."code", r."escrowBalance" AS escrow, COALESCE(SUM(p."stake"), 0)::int AS stakes
        FROM "LudoRoom" r
        LEFT JOIN "LudoPlayer" p ON p."roomId" = r."id"
        WHERE r."status" IN ('WAITING', 'ACTIVE', 'PAUSED')
        GROUP BY r."id", r."code", r."escrowBalance"
        ORDER BY r."createdAt"
      `,
    ]);
    const studentBalance = students._sum.devCoins ?? 0;
    const studentLedgerBalance = studentLedger._sum.delta ?? 0;
    const treasuryBalance = treasury?.balance ?? 0;
    const treasuryLedgerBalance = treasuryLedger._sum.delta ?? 0;
    const escrowBalance = rooms.reduce((sum, room) => sum + room.escrow, 0);
    const escrowReconciled = rooms.every(room => room.escrow === room.stakes);
    console.log(JSON.stringify({
      ludoSchemaReady: true,
      studentBalance,
      studentLedgerBalance,
      studentsReconciled: studentBalance === studentLedgerBalance,
      treasuryBalance,
      treasuryLedgerBalance,
      treasuryReconciled: treasuryBalance === treasuryLedgerBalance,
      escrowBalance,
      escrowReconciled,
      managedSupplyObserved: studentBalance + treasuryBalance + escrowBalance,
      declaredTotalSupply: treasury?.totalSupply ?? null,
      totalSupplyReconciled: treasury ? studentBalance + treasuryBalance + escrowBalance === treasury.totalSupply : false,
      activeRooms: rooms,
    }, null, 2));
  } finally { await prisma.$disconnect(); }
}

void main();
