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
    const count = await prisma.user.count();
    console.log(`Conexão Neon OK. Usuários cadastrados: ${count}.`);
    const accounts = await prisma.user.findMany({ select: { accessCode: true, firstName: true, lastName: true, role: true, status: true } });
    for (const account of accounts) console.log(`${account.accessCode}: ${account.firstName} ${account.lastName}, ${account.role}, ${account.status}.`);
  } finally {
    await prisma.$disconnect();
  }
}
void main();
