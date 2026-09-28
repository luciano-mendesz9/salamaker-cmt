import Link from "next/link";
import { Images, UserRound } from "lucide-react";
import { notFound } from "next/navigation";
import { ProfessorShell } from "@/components/professor-shell";
import { localAssetManagerEnabled } from "@/lib/local-asset-manager";
export default async function MediaIndex(){if(!(await localAssetManagerEnabled()))notFound();return <ProfessorShell title="Mídias locais"><div className="grid gap-5 md:grid-cols-2"><Card href="/professor/midias/perfis" icon={UserRound} title="Fotos de perfil" text="Prepare avatares 512 × 512 e regenere a allowlist de imports."/><Card href="/professor/midias/figurinhas" icon={Images} title="Figurinhas" text="Prepare imagens 3:4, manifestos e registros sem tocar no banco."/></div><p className="mt-6 rounded-xl border border-amber-300/20 bg-amber-300/8 p-4 text-sm text-amber-100">As alterações são locais. Revise git status e git diff, faça commit e deploy; só depois ative figurinhas no catálogo de produção.</p></ProfessorShell>}
function Card({href,icon:Icon,title,text}:{href:string;icon:typeof Images;title:string;text:string}){return <Link href={href} className="glass rounded-2xl p-6 transition hover:border-blue-400/40"><Icon className="text-blue-300"/><h2 className="mt-4 font-display text-xl font-bold">{title}</h2><p className="mt-2 text-sm text-slate-400">{text}</p></Link>}
