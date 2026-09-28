import "server-only";
import { promises as fs, constants as fsConstants } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { generateProfileRegistry, generateStickerRegistry, PROFILE_ASSET_DIR, PROFILE_CATALOG_PATH, PROFILE_REGISTRY_PATH, PROJECT_ROOT, sha256, STICKER_ASSET_DIR, STICKER_CATALOG_DIR, STICKER_REGISTRY_PATH, writeAtomic, type ProfileCatalogEntry, type StickerCatalogEntry } from "@/lib/asset-catalog-files";
import { isSafeAssetSlug, stickerRarity, stickerScore } from "@/lib/stickers";
import { convertAssetImage } from "@/lib/image-processing";

const profileInput=z.object({slug:z.string(),label:z.string().trim().min(2).max(100),alt:z.string().trim().min(3).max(240),cropConfirmed:z.literal("true"),rightsConfirmed:z.literal("true")});
const stickerInput=z.object({slug:z.string(),collectionSlug:z.string(),collectionName:z.string().trim().min(2).max(100),number:z.coerce.number().int().positive(),name:z.string().trim().min(2).max(120),description:z.string().trim().min(3).max(500),alt:z.string().trim().min(3).max(240),totalCopies:z.coerce.number().int().min(30).max(100000),cropConfirmed:z.literal("true"),rightsConfirmed:z.literal("true")});

export function localAssetManagerConfigured(){return process.env.NODE_ENV!=="production"&&process.env.ENABLE_LOCAL_ASSET_MANAGER==="true"}
export async function localAssetManagerEnabled(){if(!localAssetManagerConfigured())return false;try{await fs.access(PROJECT_ROOT,fsConstants.W_OK);return true}catch{return false}}

async function readJson<T>(filePath:string,fallback:T):Promise<T>{try{return JSON.parse(await fs.readFile(filePath,"utf8")) as T}catch(error){if((error as NodeJS.ErrnoException).code==="ENOENT")return fallback;throw error}}
async function allStickerEntries(){const names=(await fs.readdir(STICKER_CATALOG_DIR).catch(()=>[])).filter(name=>name.endsWith(".json")).sort();const groups=await Promise.all(names.map(name=>readJson<StickerCatalogEntry[]>(path.join(STICKER_CATALOG_DIR,name),[])));return groups.flat()}

async function decodeUpload(file:File,width:number,height:number){return convertAssetImage(Buffer.from(await file.arrayBuffer()),width,height)}

async function withAssetLock<T>(operation:()=>Promise<T>){
  const lockPath=path.join(PROJECT_ROOT,".asset-manager.lock");let handle;
  try{handle=await fs.open(lockPath,"wx");return await operation()}catch(error){if((error as NodeJS.ErrnoException).code==="EEXIST")throw new Error("ASSET_MANAGER_BUSY");throw error}finally{await handle?.close();await fs.unlink(lockPath).catch(()=>undefined)}
}

export async function listLocalAssets(){return {profiles:await readJson<ProfileCatalogEntry[]>(PROFILE_CATALOG_PATH,[]),stickers:await allStickerEntries()}}

export async function prepareProfileAsset(form:FormData){
  if(!(await localAssetManagerEnabled()))throw new Error("NOT_FOUND");const values=profileInput.parse(Object.fromEntries(form));if(!isSafeAssetSlug(values.slug)||values.slug==="default")throw new Error("INVALID_SLUG");const file=form.get("file");if(!(file instanceof File))throw new Error("MISSING_FILE");
  return withAssetLock(async()=>{const catalog=await readJson<ProfileCatalogEntry[]>(PROFILE_CATALOG_PATH,[]);if(catalog.some(item=>item.key===values.slug))throw new Error("DUPLICATE_SLUG");const output=await decodeUpload(file,512,512);const hash=sha256(output);if(catalog.some(item=>item.sha256===hash))throw new Error("DUPLICATE_IMAGE");const destination=path.join(PROFILE_ASSET_DIR,`${values.slug}.webp`);await fs.access(destination).then(()=>{throw new Error("DUPLICATE_SLUG")}).catch(error=>{if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error});const entry:ProfileCatalogEntry={key:values.slug,label:values.label,alt:values.alt,imagePath:`src/assets/profiles/${values.slug}.webp`,width:512,height:512,bytes:output.length,sha256:hash,paid:true,preparedAt:new Date().toISOString()};const next=[...catalog,entry].sort((a,b)=>a.key.localeCompare(b.key,"en",{numeric:true}));const oldCatalog=await fs.readFile(PROFILE_CATALOG_PATH).catch(()=>null);const oldRegistry=await fs.readFile(PROFILE_REGISTRY_PATH).catch(()=>null);try{await writeAtomic(destination,output);await writeAtomic(PROFILE_CATALOG_PATH,`${JSON.stringify(next,null,2)}\n`);await writeAtomic(PROFILE_REGISTRY_PATH,generateProfileRegistry(next));return entry}catch(error){await fs.unlink(destination).catch(()=>undefined);if(oldCatalog)await writeAtomic(PROFILE_CATALOG_PATH,oldCatalog);if(oldRegistry)await writeAtomic(PROFILE_REGISTRY_PATH,oldRegistry);throw error}})
}

export async function prepareStickerAsset(form:FormData){
  if(!(await localAssetManagerEnabled()))throw new Error("NOT_FOUND");const values=stickerInput.parse(Object.fromEntries(form));if(!isSafeAssetSlug(values.slug)||!isSafeAssetSlug(values.collectionSlug))throw new Error("INVALID_SLUG");const file=form.get("file");if(!(file instanceof File))throw new Error("MISSING_FILE");
  return withAssetLock(async()=>{const all=await allStickerEntries();if(all.some(item=>item.slug===values.slug))throw new Error("DUPLICATE_SLUG");if(all.some(item=>item.collectionSlug===values.collectionSlug&&item.number===values.number))throw new Error("DUPLICATE_NUMBER");const output=await decodeUpload(file,900,1200);const hash=sha256(output);if(all.some(item=>item.sha256===hash))throw new Error("DUPLICATE_IMAGE");const destinationDir=path.join(STICKER_ASSET_DIR,values.collectionSlug);const destination=path.join(destinationDir,`${values.slug}.webp`);const manifestPath=path.join(STICKER_CATALOG_DIR,`${values.collectionSlug}.json`);const current=await readJson<StickerCatalogEntry[]>(manifestPath,[]);const entry:StickerCatalogEntry={slug:values.slug,number:values.number,name:values.name,description:values.description,alt:values.alt,collectionSlug:values.collectionSlug,collectionName:values.collectionName,imagePath:`/media/stickers/${values.collectionSlug}/${values.slug}.webp`,totalCopies:values.totalCopies,rarity:stickerRarity(values.totalCopies),score:stickerScore(values.totalCopies),state:"DRAFT",sha256:hash,width:900,height:1200,bytes:output.length,preparedAt:new Date().toISOString()};const nextCollection=[...current,entry].sort((a,b)=>a.number-b.number);const nextAll=[...all,entry].sort((a,b)=>a.collectionSlug.localeCompare(b.collectionSlug)||a.number-b.number);const oldManifest=await fs.readFile(manifestPath).catch(()=>null);const oldRegistry=await fs.readFile(STICKER_REGISTRY_PATH).catch(()=>null);try{await fs.mkdir(destinationDir,{recursive:true});await writeAtomic(destination,output);await writeAtomic(manifestPath,`${JSON.stringify(nextCollection,null,2)}\n`);await writeAtomic(STICKER_REGISTRY_PATH,generateStickerRegistry(nextAll));return entry}catch(error){await fs.unlink(destination).catch(()=>undefined);if(oldManifest)await writeAtomic(manifestPath,oldManifest);else await fs.unlink(manifestPath).catch(()=>undefined);if(oldRegistry)await writeAtomic(STICKER_REGISTRY_PATH,oldRegistry);throw error}})
}
