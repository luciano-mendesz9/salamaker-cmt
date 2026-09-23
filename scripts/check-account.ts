import "dotenv/config";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import WebSocket from "ws";
import { PrismaClient } from "../src/generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;
const accessCode = process.argv[2]?.trim().toUpperCase();
if (!databaseUrl || !accessCode) throw new Error("Uso: npm run db:check-account -- CODIGO");
neonConfig.webSocketConstructor = WebSocket;
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: databaseUrl }) });
async function main() {
  try {
    const account = await prisma.user.findUnique({ where: { accessCode }, select: { role: true, status: true, mustChangePassword: true } });
    console.log(account ? `Conta encontrada: papel=${account.role}, status=${account.status}, trocaObrigatoria=${account.mustChangePassword}.` : "Conta não encontrada.");
  } finally { await prisma.$disconnect(); }
}
void main();
