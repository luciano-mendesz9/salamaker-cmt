import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

export const PROJECT_ROOT = process.cwd();
export const PROFILE_ASSET_DIR = path.join(PROJECT_ROOT, "src/assets/profiles");
export const PROFILE_CATALOG_PATH = path.join(PROJECT_ROOT, "src/content/profile-avatar-catalog.json");
export const PROFILE_REGISTRY_PATH = path.join(PROJECT_ROOT, "src/lib/profile-avatar-assets.generated.ts");
export const STICKER_ASSET_DIR = path.join(PROJECT_ROOT, "public/media/stickers");
export const STICKER_CATALOG_DIR = path.join(PROJECT_ROOT, "src/content/sticker-catalog");
export const STICKER_REGISTRY_PATH = path.join(PROJECT_ROOT, "src/content/sticker-catalog.generated.ts");

export type ProfileCatalogEntry = { key:string; label:string; alt:string; imagePath:string; width:number; height:number; bytes:number; sha256:string; paid:boolean; preparedAt:string|null };
export type StickerCatalogEntry = { slug:string; number:number; name:string; description:string; alt:string; collectionSlug:string; collectionName:string; imagePath:string; totalCopies:number; rarity:"LOW"|"MEDIUM"|"HIGH"; score:number; state:"DRAFT"; sha256:string; width:number; height:number; bytes:number; preparedAt:string };

export function sha256(buffer: Buffer) { return createHash("sha256").update(buffer).digest("hex"); }

export function generateProfileRegistry(entries: ProfileCatalogEntry[]) {
  const imports = entries.map((entry,index)=>`import avatar${index} from "@/assets/profiles/${entry.key}.webp";`).join("\n");
  const rows = entries.map((entry,index)=>`  { key: ${JSON.stringify(entry.key)}, image: avatar${index} },`).join("\n");
  return `/* This file is generated from src/content/profile-avatar-catalog.json. */\nimport type { StaticImageData } from "next/image";\n${imports}\n\nexport const GENERATED_PROFILE_AVATARS = [\n${rows}\n] as const satisfies ReadonlyArray<{ key: string; image: StaticImageData }>;\n`;
}

export function generateStickerRegistry(entries: StickerCatalogEntry[]) {
  return `/* This file is generated from src/content/sticker-catalog/*.json. */\nimport type { StickerCatalogEntry } from "@/lib/asset-catalog-files";\nexport const STICKER_CATALOG: readonly StickerCatalogEntry[] = ${JSON.stringify(entries, null, 2)};\n`;
}

export async function writeAtomic(filePath: string, contents: string | Buffer) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temp = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  await fs.writeFile(temp, contents, { flag: "wx" });
  await fs.rename(temp, filePath);
}
