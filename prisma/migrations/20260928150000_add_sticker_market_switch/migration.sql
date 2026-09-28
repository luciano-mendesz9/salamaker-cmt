CREATE TABLE "StickerMarketSetting" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StickerMarketSetting_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StickerMarketSetting_singleton_check" CHECK ("id" = 1)
);

INSERT INTO "StickerMarketSetting" ("id", "enabled", "updatedAt")
VALUES (1, false, CURRENT_TIMESTAMP);
