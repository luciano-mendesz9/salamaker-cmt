/* Blob previews are local-only and cannot use the Next image optimizer. */
/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { ImagePlus, Upload } from "lucide-react";
import { toast } from "sonner";

export function LocalAssetForm({ kind }: { kind: "profile" | "sticker" }) {
  const [preview, setPreview] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch(`/api/professor/local-assets/${kind === "profile" ? "profiles" : "stickers"}`, {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      toast.success("Arquivo, manifesto e registro gerado foram preparados. Revise o diff antes do commit.");
      location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao preparar mídia.");
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="glass grid gap-5 rounded-2xl p-5 lg:grid-cols-2">
    <div className="lg:col-span-2">
      <h2 className="flex items-center gap-2 font-display text-xl font-bold"><ImagePlus />Nova {kind === "profile" ? "foto de perfil" : "figurinha"}</h2>
      <p className="mt-1 text-sm text-slate-400">O servidor valida o conteúdo real, remove metadados e grava WebP sem sobrescrever arquivos.</p>
    </div>

    <label className="text-sm lg:col-span-2">
      <span className="font-bold">{kind === "profile" ? "Imagem do perfil" : "Imagem da figurinha (proporção 3:4)"}</span>
      <span className="mt-1 block text-xs leading-relaxed text-slate-400">{kind === "profile" ? "Escolha uma imagem JPEG, PNG ou WebP. Ela será recortada para 512 × 512 pixels." : "Escolha uma imagem JPEG, PNG ou WebP. Use preferencialmente a proporção 3:4; o resultado será recortado para 900 × 1.200 pixels."}</span>
      <input className="input mt-2" name="file" type="file" accept="image/jpeg,image/png,image/webp" required onChange={event => {
        const file = event.target.files?.[0];
        if (preview) URL.revokeObjectURL(preview);
        setPreview(file ? URL.createObjectURL(file) : undefined);
      }}/>
    </label>

    {preview && <div className={`relative overflow-hidden rounded-xl bg-slate-950 ${kind === "profile" ? "aspect-square max-w-64" : "aspect-[3/4] max-w-64"}`}>
      <img src={preview} alt="Prévia do recorte central" className="h-full w-full object-cover"/>
    </div>}

    <div className="grid gap-5">
      {kind === "sticker" && <>
        <Field name="collectionSlug" label="Identificador da coleção (slug)" hint="Nome técnico permanente, sem espaços ou acentos. Exemplo: sala-maker-2026." placeholder="sala-maker-2026"/>
        <Field name="collectionName" label="Nome visível da coleção" hint="Nome que os alunos verão no álbum. Exemplo: Sala Maker 2026." placeholder="Sala Maker 2026"/>
        <Field name="number" label="Número da figurinha na coleção" hint="Posição usada para ordenar a coleção. Deve ser único dentro desta coleção. Exemplo: 1, 2, 3…" type="number" min="1" placeholder="1"/>
      </>}

      <Field
        name="slug"
        label={kind === "profile" ? "Identificador único (slug)" : "Identificador único da figurinha (slug)"}
        hint={kind === "profile" ? "Nome técnico sem espaços ou acentos. Exemplo: cientista-maker." : "Nome técnico permanente e exclusivo, usando letras minúsculas, números e hífens. Exemplo: robo-explorador."}
        pattern="[a-z0-9][a-z0-9-]{1,38}[a-z0-9]"
        placeholder={kind === "profile" ? "cientista-maker" : "robo-explorador"}
      />
      <Field
        name={kind === "profile" ? "label" : "name"}
        label={kind === "profile" ? "Rótulo administrativo" : "Nome visível da figurinha"}
        hint={kind === "profile" ? "Nome usado para reconhecer esta opção no catálogo." : "Título que aparecerá no álbum dos alunos. Exemplo: Robô Explorador."}
        placeholder={kind === "profile" ? "Cientista Maker" : "Robô Explorador"}
      />

      {kind === "sticker" && <>
        <label className="text-sm">
          <span className="font-bold">Descrição da figurinha</span>
          <span className="mt-1 block text-xs leading-relaxed text-slate-400">Conte em uma ou duas frases o que a figurinha representa. Esse texto será apresentado ao aluno no álbum.</span>
          <textarea className="input mt-2" name="description" minLength={3} maxLength={500} placeholder="Um robô criado para explorar terrenos usando sensores e programação." required/>
        </label>
        <Field name="totalCopies" label="Quantidade total de cópias" hint="Define o estoque e a raridade: 30–100 alta, 101–250 média e 251 ou mais baixa. Mínimo de 30 cópias." type="number" min="30" placeholder="100"/>
      </>}

      <label className="text-sm">
        <span className="font-bold">Descrição visual da imagem (texto alternativo)</span>
        <span className="mt-1 block text-xs leading-relaxed text-slate-400">Descreva objetivamente o que aparece na imagem para leitores de tela. Não escreva “imagem de”.</span>
        <textarea className="input mt-2" name="alt" minLength={3} maxLength={240} placeholder={kind === "profile" ? "Pessoa usando óculos de proteção em uma bancada de eletrônica." : "Robô azul com quatro rodas e sensores sobre uma bancada."} required/>
      </label>
    </div>

    <div className="space-y-3 lg:col-span-2">
      <label className="flex gap-3 text-sm"><input type="checkbox" name="cropConfirmed" value="true" required/>Confirmo o recorte {kind === "profile" ? "quadrado (512 × 512)" : "3:4 (900 × 1.200)"} mostrado na prévia.</label>
      <label className="flex gap-3 text-sm"><input type="checkbox" name="rightsConfirmed" value="true" required/>Confirmo que esta imagem pode ser usada no projeto.</label>
    </div>

    <button className="button-primary lg:col-span-2" disabled={busy}><Upload size={18}/>{busy ? "Preparando…" : "Preparar arquivos locais"}</button>
  </form>;
}

function Field({ name, label, hint, type = "text", min, pattern, placeholder }: {
  name: string;
  label: string;
  hint: string;
  type?: string;
  min?: string;
  pattern?: string;
  placeholder?: string;
}) {
  return <label className="text-sm">
    <span className="font-bold">{label}</span>
    <span className="mt-1 block text-xs leading-relaxed text-slate-400">{hint}</span>
    <input className="input mt-2" name={name} type={type} min={min} pattern={pattern} placeholder={placeholder} required/>
  </label>;
}
