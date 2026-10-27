import { prisma } from "@/lib/db";

export type CollectiblesReadiness = {
  stickers: boolean;
  treasury: boolean;
  marketSettings: boolean;
  collectionPurchases: boolean;
  studentThemes: boolean;
  ready: boolean;
};

export async function getCollectiblesReadiness(): Promise<CollectiblesReadiness> {
  const [row] = await prisma.$queryRaw<Array<{ sticker: string | null; treasury: string | null; marketSettings: string | null; collectionPurchases: string | null; studentThemes: string | null }>>`
    SELECT
      to_regclass('public."Sticker"')::text AS "sticker",
      to_regclass('public."DevCoinTreasury"')::text AS "treasury",
      to_regclass('public."StickerMarketSetting"')::text AS "marketSettings",
      to_regclass('public."TeacherCollectionPurchaseRequest"')::text AS "collectionPurchases",
      to_regclass('public."StudentThemePurchase"')::text AS "studentThemes"
  `;
  const stickers = Boolean(row?.sticker);
  const treasury = Boolean(row?.treasury);
  const marketSettings = Boolean(row?.marketSettings);
  const collectionPurchases = Boolean(row?.collectionPurchases);
  const studentThemes = Boolean(row?.studentThemes);
  return { stickers, treasury, marketSettings, collectionPurchases, studentThemes, ready: stickers && treasury && marketSettings };
}

export async function requireCollectionPurchasesSchema() {
  if (!(await getCollectiblesReadiness()).collectionPurchases) throw new Error("COLLECTION_PURCHASES_SCHEMA_NOT_READY");
}

export async function requireCollectiblesSchema() {
  if (!(await getCollectiblesReadiness()).ready) throw new Error("COLLECTIBLES_SCHEMA_NOT_READY");
}

export async function requireStudentThemesSchema() {
  const readiness = await getCollectiblesReadiness();
  if (!readiness.ready) throw new Error("COLLECTIBLES_SCHEMA_NOT_READY");
  if (!readiness.studentThemes) throw new Error("STUDENT_THEMES_SCHEMA_NOT_READY");
}
