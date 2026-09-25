"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, LockKeyhole, Pencil, ShoppingCart, X } from "lucide-react";
import { toast } from "sonner";
import { PROFILE_AVATAR_DEV_COIN_PRICE } from "@/lib/profile-avatar-pricing";
import { getProfileAvatar, PROFILE_AVATARS, type ProfileAvatarKey } from "@/lib/profile-avatars";

type Props = { currentAvatar: string; currentDevCoins: number; ownedAvatars: string[]; studentName: string };

export function ProfileAvatarEditor({ currentAvatar, currentDevCoins, ownedAvatars, studentName }: Props) {
  const router = useRouter();
  const initialAvatar = PROFILE_AVATARS.some(({ key }) => key === currentAvatar) ? currentAvatar as ProfileAvatarKey : "default";
  const [active, setActive] = useState<ProfileAvatarKey>(initialAvatar);
  const [candidate, setCandidate] = useState<ProfileAvatarKey>(initialAvatar);
  const [owned, setOwned] = useState(() => new Set(ownedAvatars));
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const price = PROFILE_AVATAR_DEV_COIN_PRICE;
  const candidateOwned = candidate === "default" || owned.has(candidate);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !saving) setOpen(false); };
    document.addEventListener("keydown", closeOnEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, saving]);

  async function applySelection() {
    if (candidate === active || saving) return;
    setSaving(true);
    const response = await fetch("/api/student/profile-avatar", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ avatar: candidate }),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      toast.error(data.message ?? "Não foi possível atualizar a foto.");
      return;
    }
    setActive(candidate);
    if (data.purchasedNow) setOwned(current => new Set(current).add(candidate));
    toast.success(data.purchasedNow ? `Foto comprada por ${data.pricePaid} Dev-Coins e aplicada ao perfil.` : "Foto de perfil atualizada.");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button type="button" onClick={() => { setCandidate(active); setOpen(true); }} className="focus-ring group relative h-24 w-24 shrink-0 rounded-3xl sm:h-28 sm:w-28" aria-label="Alterar foto de perfil">
        <Image src={getProfileAvatar(active)} alt={`Foto de perfil de ${studentName}`} fill priority sizes="112px" className="rounded-3xl border-2 border-blue-300/30 object-cover shadow-xl transition group-hover:border-blue-300/70" />
        <span className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full border-2 border-[#142b4d] bg-blue-500 text-white shadow-lg transition group-hover:scale-105" aria-hidden="true"><Pencil size={16} /></span>
      </button>
      {open && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/80 p-3 backdrop-blur-sm sm:p-4" onMouseDown={event => { if (event.target === event.currentTarget && !saving) setOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="profile-avatar-title" className="glass flex max-h-[94vh] w-full max-w-4xl flex-col rounded-3xl p-4 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Loja de fotos do perfil</p>
                <h2 id="profile-avatar-title" className="mt-2 font-display text-2xl font-bold">Escolha sua foto</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300"><strong className="text-amber-300">Cada foto custa 20 Dev-Coins.</strong> Você paga uma única vez e depois pode usar a foto quando quiser.</p>
                <p className="mt-1 text-sm font-bold text-amber-300">Seu saldo: {currentDevCoins} Dev-Coins</p>
              </div>
              <button autoFocus type="button" disabled={saving} onClick={() => setOpen(false)} className="focus-ring rounded-xl border border-slate-700 p-2.5 text-slate-300 hover:bg-slate-800" aria-label="Fechar seleção de foto"><X size={20} /></button>
            </div>
            <div className="mt-5 grid min-h-0 flex-1 grid-cols-3 gap-3 overflow-y-auto pr-1 sm:grid-cols-5 md:grid-cols-8">
              {PROFILE_AVATARS.map(({ key, image }) => {
                const selected = key === candidate;
                const isOwned = key === "default" || owned.has(key);
                return (
                  <button key={key} type="button" disabled={saving} onClick={() => setCandidate(key)} aria-label={key === "default" ? "Selecionar imagem padrão gratuita" : `Selecionar foto ${key}, ${isOwned ? "já comprada" : `${price} Dev-Coins`}`} aria-pressed={selected} className={`focus-ring rounded-2xl border-2 p-1.5 text-center transition ${selected ? "border-blue-300 bg-blue-400/10 ring-2 ring-blue-300/25" : "border-slate-700 hover:border-blue-400/60"}`}>
                    <span className="relative block aspect-square overflow-hidden rounded-xl">
                      <Image src={image} alt="" fill sizes="(max-width: 640px) 30vw, 96px" className="object-cover" />
                      {key === active && <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-blue-500 text-white shadow" title="Em uso"><Check size={15} strokeWidth={3} /></span>}
                    </span>
                    <span className={`mt-1.5 flex min-h-5 items-center justify-center gap-1 text-[11px] font-bold ${isOwned ? "text-emerald-300" : "text-amber-300"}`}>
                      {key === "default" ? "Grátis" : isOwned ? <><Check size={12} />Comprada</> : <>{price} Dev-Coins</>}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-950/45 p-4 sm:flex sm:items-center sm:justify-between sm:gap-5">
              <div className="text-sm">
                {candidate === active ? <p className="text-slate-300">Esta é a foto que está em uso.</p> : candidateOwned ? <p className="flex items-center gap-2 text-emerald-300"><Check size={16} />Esta foto já é sua. Não haverá nova cobrança.</p> : <p className="text-slate-200"><strong>Confirmar compra?</strong> Serão debitadas <span className="font-bold text-amber-300">{price} Dev-Coins</span>. Seu saldo ficará em {currentDevCoins - price}.</p>}
              </div>
              <button type="button" disabled={candidate === active || saving || (!candidateOwned && currentDevCoins < price)} onClick={applySelection} className="button-primary mt-3 w-full whitespace-nowrap sm:mt-0 sm:w-auto">
                {saving ? "Processando…" : candidate === active ? "Foto em uso" : candidateOwned ? <><Check size={17} />Usar esta foto</> : <><ShoppingCart size={17} />Confirmar compra</>}
              </button>
            </div>
            {!candidateOwned && candidate !== active && <p className={`mt-2 flex items-center gap-1.5 text-xs ${currentDevCoins < price ? "text-rose-300" : "text-slate-400"}`}><LockKeyhole size={13} />{currentDevCoins < price ? "Você precisa comprar mais Dev-Coins antes de escolher esta foto." : "A compra e o débito das moedas só acontecem após sua confirmação."}</p>}
          </section>
        </div>
      )}
    </>
  );
}
