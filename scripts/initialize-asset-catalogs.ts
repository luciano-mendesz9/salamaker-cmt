import "dotenv/config";
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { generateProfileRegistry, generateStickerRegistry, PROFILE_ASSET_DIR, PROFILE_CATALOG_PATH, PROFILE_REGISTRY_PATH, sha256, STICKER_CATALOG_DIR, STICKER_REGISTRY_PATH, writeAtomic, type ProfileCatalogEntry } from "../src/lib/asset-catalog-files";

async function main(){
  const files=(await fs.readdir(PROFILE_ASSET_DIR)).filter(name=>name.endsWith(".webp")).sort((a,b)=>a.localeCompare(b,"en",{numeric:true}));
  const entries:ProfileCatalogEntry[]=[];
  for(const file of files){const buffer=await fs.readFile(path.join(PROFILE_ASSET_DIR,file));const metadata=await sharp(buffer).metadata();const key=file.slice(0,-5);entries.push({key,label:key==="default"?"Imagem padrão":`Avatar ${key}`,alt:key==="default"?"Avatar padrão do aluno":`Avatar ${key}`,imagePath:`src/assets/profiles/${file}`,width:metadata.width??0,height:metadata.height??0,bytes:buffer.length,sha256:sha256(buffer),paid:key!=="default",preparedAt:null});}
  await writeAtomic(PROFILE_CATALOG_PATH,`${JSON.stringify(entries,null,2)}\n`);
  await writeAtomic(PROFILE_REGISTRY_PATH,generateProfileRegistry(entries));
  await fs.mkdir(STICKER_CATALOG_DIR,{recursive:true});
  await writeAtomic(STICKER_REGISTRY_PATH,generateStickerRegistry([]));
  console.log(`Catálogos inicializados: ${entries.length} avatares e 0 figurinhas.`);
}
void main();
