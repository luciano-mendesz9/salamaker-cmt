import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import NodeWebSocket from "ws";
import { PrismaClient } from "@/generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL não configurada.");
// Modern serverless runtimes provide a native WebSocket implementation. Keep
// the Node fallback for local runtimes (such as Node 20) that do not.
if (typeof globalThis.WebSocket === "undefined") {
  neonConfig.webSocketConstructor = NodeWebSocket;
}
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter: new PrismaNeon({ connectionString: databaseUrl }) });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
