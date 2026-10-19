"use client";
import Link from "next/link";
import { Check, Copy, ExternalLink, Gamepad2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const TINKERCAD_URL = "https://www.tinkercad.com/joinclass/ABJNGWPUT";

export function TinkercadCard({ accessCode }: { accessCode: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(accessCode);
    setCopied(true);
    toast.success("Código copiado.");
    setTimeout(() => setCopied(false), 2_000);
  }
  return <>
    <section className="relative mt-5 overflow-hidden rounded-2xl border border-cyan-300/25 bg-gradient-to-r from-cyan-400/15 via-blue-400/10 to-indigo-400/10 p-5 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <a href={TINKERCAD_URL} target="_blank" rel="noreferrer" className="focus-ring group min-w-0 flex-1 rounded-xl">
          <p className="eyebrow">Tinkercad</p>
          <h2 className="mt-2 flex items-center gap-2 font-display text-xl font-bold">Acessar sua conta Tinkercad <ExternalLink className="text-cyan-300 transition group-hover:translate-x-1" size={18}/></h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">Na nova aba, escolha <strong>“Entrar com login de aluno”</strong> e informe seu código de matrícula.</p>
        </a>
        <div className="shrink-0 rounded-xl border border-cyan-300/20 bg-slate-950/45 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Seu código</p>
          <div className="mt-1 flex items-center gap-3"><strong className="font-mono text-lg text-cyan-200">{accessCode}</strong><button onClick={copy} className="focus-ring rounded-lg bg-cyan-300/10 p-2 text-cyan-200 hover:bg-cyan-300/20" aria-label="Copiar código de acesso">{copied ? <Check size={18}/> : <Copy size={18}/>}</button></div>
        </div>
      </div>
    </section>
    <Link href="/aluno/minigames" className="focus-ring group mt-5 flex items-center gap-4 rounded-2xl border border-fuchsia-300/25 bg-gradient-to-r from-fuchsia-500/15 via-cyan-400/10 to-blue-500/10 p-5 transition hover:-translate-y-0.5 hover:border-fuchsia-300/45 sm:p-6">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-fuchsia-400/15 text-fuchsia-200"><Gamepad2 size={27}/></span>
      <span className="min-w-0 flex-1"><span className="eyebrow">Diversão com responsabilidade</span><strong className="mt-1 block font-display text-xl">Acessar Mini games</strong><span className="mt-1 block text-sm text-slate-300">Entre no Ludo Maker, consulte partidas e jogue com seus colegas.</span></span>
    </Link>
  </>;
}
