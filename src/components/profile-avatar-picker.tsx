"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { getProfileAvatar, PROFILE_AVATARS, type ProfileAvatarKey } from "@/lib/profile-avatars";

export function ProfileAvatarEditor({ currentAvatar, studentName }: { currentAvatar: string; studentName: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<ProfileAvatarKey>(
    PROFILE_AVATARS.some(({ key }) => key === currentAvatar) ? currentAvatar as ProfileAvatarKey : "default",
  );
  const [saving, setSaving] = useState<ProfileAvatarKey | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  async function choose(avatar: ProfileAvatarKey) {
    if (avatar === selected || saving) return;
    setSaving(avatar);
    const response = await fetch("/api/student/profile-avatar", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ avatar }),
    });
    const data = await response.json();
    setSaving(null);
    if (!response.ok) {
      toast.error(data.message);
      return;
    }
    setSelected(avatar);
    toast.success("Foto de perfil atualizada.");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="focus-ring group relative h-24 w-24 shrink-0 rounded-3xl sm:h-28 sm:w-28" aria-label="Alterar foto de perfil">
        <Image src={getProfileAvatar(selected)} alt={`Foto de perfil de ${studentName}`} fill priority sizes="112px" className="rounded-3xl border-2 border-blue-300/30 object-cover shadow-xl transition group-hover:border-blue-300/70" />
        <span className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full border-2 border-[#142b4d] bg-blue-500 text-white shadow-lg transition group-hover:scale-105" aria-hidden="true"><Pencil size={16} /></span>
      </button>
      {open && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget && !saving) setOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="profile-avatar-title" className="glass max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Personalizar perfil</p>
                <h2 id="profile-avatar-title" className="mt-2 font-display text-2xl font-bold">Escolha sua foto</h2>
                <p className="mt-2 text-sm text-slate-400">Ela aparecerá no seu painel e no ranking.</p>
              </div>
              <button autoFocus type="button" disabled={saving !== null} onClick={() => setOpen(false)} className="focus-ring rounded-xl border border-slate-700 p-2.5 text-slate-300 hover:bg-slate-800" aria-label="Fechar seleção de foto"><X size={20} /></button>
            </div>
            <div className="mt-6 grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-8">
              {PROFILE_AVATARS.map(({ key, image }) => {
                const active = key === selected;
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={saving !== null}
                    onClick={() => choose(key)}
                    aria-label={key === "default" ? "Usar imagem sem perfil" : `Usar foto de perfil ${key}`}
                    aria-pressed={active}
                    className={`focus-ring relative aspect-square overflow-hidden rounded-2xl border-2 transition ${active ? "border-blue-300 ring-2 ring-blue-300/25" : "border-slate-700 hover:border-blue-400/60"}`}
                  >
                    <Image src={image} alt="" fill sizes="(max-width: 640px) 20vw, 96px" className="object-cover" />
                    {active && <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-blue-500 text-white shadow"><Check size={15} strokeWidth={3} /></span>}
                    {saving === key && <span className="absolute inset-0 grid place-items-center bg-slate-950/65 text-[10px] font-bold text-white">Salvando…</span>}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
