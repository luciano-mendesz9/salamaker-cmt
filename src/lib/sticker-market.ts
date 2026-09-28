import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

type Tx = Prisma.TransactionClient;

export async function getStickerMarketEnabled() {
  const setting = await prisma.stickerMarketSetting.findUnique({ where: { id: 1 }, select: { enabled: true } });
  return setting?.enabled ?? false;
}

export async function assertStickerMarketEnabled(tx: Tx) {
  const [setting] = await tx.$queryRaw<Array<{ enabled: boolean }>>`
    SELECT "enabled"
    FROM "StickerMarketSetting"
    WHERE "id" = 1
    FOR SHARE
  `;
  if (!setting?.enabled) throw new Error("STICKER_MARKET_DISABLED");
}
