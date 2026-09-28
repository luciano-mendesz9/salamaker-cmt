import Image from "next/image";
import { notFound } from "next/navigation";
import { LocalAssetForm } from "@/components/local-asset-form";
import { ProfessorShell } from "@/components/professor-shell";
import { listLocalAssets, localAssetManagerEnabled } from "@/lib/local-asset-manager";
import { getProfileAvatar } from "@/lib/profile-avatars";
export default async function ProfilesMediaPage(){if(!(await localAssetManagerEnabled()))notFound();const{profiles}=await listLocalAssets();return <ProfessorShell title="Fotos de perfil locais"><LocalAssetForm kind="profile"/><section className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">{profiles.map(item=><article key={item.key} className="glass rounded-2xl p-3"><Image src={getProfileAvatar(item.key)} alt={item.alt} width={160} height={160} className="aspect-square w-full rounded-xl object-cover"/><p className="mt-3 font-bold">{item.key}</p><p className="text-xs text-slate-400">{item.width} × {item.height} · {(item.bytes/1024).toFixed(1)} KB</p><p className="text-xs text-slate-500">{item.sha256.slice(0,10)} · {item.paid?"paga":"padrão"}</p></article>)}</section></ProfessorShell>}
