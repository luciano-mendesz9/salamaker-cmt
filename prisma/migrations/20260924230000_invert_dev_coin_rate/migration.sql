ALTER TABLE "AppSetting"
RENAME COLUMN "xpPerDevCoin" TO "devCoinsPerXp";

ALTER TABLE "AppSetting"
RENAME CONSTRAINT "AppSetting_xpPerDevCoin_check" TO "AppSetting_devCoinsPerXp_check";
