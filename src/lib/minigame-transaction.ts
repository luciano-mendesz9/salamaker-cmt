import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export async function minigameTransaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: "Serializable", maxWait: 10_000, timeout: 20_000 });
    } catch (error) {
      if ((error as { code?: string }).code === "P2034" && attempt < 2) continue;
      throw error;
    }
  }
  throw new Error("TRANSACTION_RETRY_EXHAUSTED");
}
