import { prisma } from "@/lib/db";
import { requestHasSameOrigin } from "@/lib/request-origin";

export function assertSameOrigin(request: Request) {
  if (!requestHasSameOrigin(request)) throw new Error("INVALID_ORIGIN");
}

export async function consumeRateLimit(key: string, limit: number, windowMs: number) {
  const now = new Date();
  await prisma.$transaction(async tx => {
    const current = await tx.rateLimitBucket.findUnique({ where: { key } });
    if (!current || current.windowEnd <= now) {
      await tx.rateLimitBucket.upsert({ where: { key }, create: { key, attempts: 1, windowEnd: new Date(now.getTime() + windowMs) }, update: { attempts: 1, windowEnd: new Date(now.getTime() + windowMs) } });
      return;
    }
    if (current.attempts >= limit) throw new Error("RATE_LIMITED");
    await tx.rateLimitBucket.update({ where: { key }, data: { attempts: { increment: 1 } } });
  }, { isolationLevel: "Serializable" });
}
