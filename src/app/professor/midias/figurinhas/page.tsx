import Image from "next/image";
import { notFound } from "next/navigation";
import { LocalAssetForm } from "@/components/local-asset-form";
import { ProfessorShell } from "@/components/professor-shell";
import { listLocalAssets, localAssetManagerEnabled } from "@/lib/local-asset-manager";
export default async function StickerMediaPage(){if(!(await localAssetManagerEnabled()))notFound();const{stickers}=await listLocalAssets();return <ProfessorShell title="Figurinhas locais"><LocalAssetForm kind="sticker"/><section className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">{stickers.map(item=><article key={item.slug} className="glass overflow-hidden rounded-2xl"><div className="relative aspect-[3/4]"><Image src={item.imagePath} alt={item.alt} fill className="object-cover"/></div><div className="p-3"><p className="text-xs text-slate-500">#{item.number} · {item.collectionName}</p><p className="font-bold">{item.name}</p><p className="text-xs text-slate-400">{item.rarity} · {item.score} pts · {item.totalCopies} cópias</p><p className="mt-1 text-[10px] text-amber-200">Preparada; ainda não ativa no banco</p></div></article>)}</section></ProfessorShell>}
