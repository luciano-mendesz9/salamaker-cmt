import { prisma } from "@/lib/db";

export type CollectiblesReadiness = {
  stickers: boolean;
  treasury: boolean;
  marketSettings: boolean;
  ready: boolean;
};

export async function getCollectiblesReadiness(): Promise<CollectiblesReadiness> {
  const [row] = await prisma.$queryRaw<Array<{ sticker: string | null; treasury: string | null; marketSettings: string | null }>>`
    SELECT
      to_regclass('public."Sticker"')::text AS "sticker",
      to_regclass('public."DevCoinTreasury"')::text AS "treasury",
      to_regclass('public."StickerMarketSetting"')::text AS "marketSettings"
  `;
  const stickers = Boolean(row?.sticker);
  const treasury = Boolean(row?.treasury);
  const marketSettings = Boolean(row?.marketSettings);
  return { stickers, treasury, marketSettings, ready: stickers && treasury && marketSettings };
}

export async function requireCollectiblesSchema() {
  if (!(await getCollectiblesReadiness()).ready) throw new Error("COLLECTIBLES_SCHEMA_NOT_READY");
}
