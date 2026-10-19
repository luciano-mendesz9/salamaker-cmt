"use client";

import { useMemo, useState } from "react";
import { CircleDollarSign, Dices, Trophy, UsersRound, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type Collection = { id: string; name: string; stickerCount: number; suggestedXp: number };
type Offer = { id: string; name: string; state: "ACTIVE" | "SELECTED" | "NOT_SELECTED" | "WITHDRAWN" };
type PurchaseRequest = {
  id: string;
  collectionName: string;
  suggestedXp: number;
  xpAmount: number;
  state: "OPEN" | "COMPLETED" | "CANCELLED";
  createdAt: string;
  offers: Offer[];
  purchase: { name: string; xpAmount: number; createdAt: string } | null;
};

async function jsonRequest(url: string, options: RequestInit) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? "Não foi possível concluir a operação.");
  return data;
}

export function TeacherCollectionPurchaseManager({ collections, requests }: { collections: Collection[]; requests: PurchaseRequest[] }) {
  const router = useRouter();
  const first = collections[0];
  const [collectionId, setCollectionId] = useState(first?.id ?? "");
  const selectedCollection = useMemo(() => collections.find(item => item.id === collectionId) ?? first, [collectionId, collections, first]);
  const [xpAmount, setXpAmount] = useState(first?.suggestedXp ?? 1);
  const [busy, setBusy] = useState<string | null>(null);
  const [wheelName, setWheelName] = useState<Record<string, string>>({});
  const openRequests = requests.filter(request => request.state === "OPEN");
  const history = requests.filter(request => request.state !== "OPEN");

  function changeCollection(id: string) {
    setCollectionId(id);
    const collection = collections.find(item => item.id === id);
    if (collection) setXpAmount(collection.suggestedXp);
  }

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("create");
    try {
      await jsonRequest("/api/professor/stickers/collection-purchases", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ collectionId, xpAmount }) });
      toast.success("Pedido publicado no álbum e nas notificações dos alunos.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível abrir a compra.");
    } finally { setBusy(null); }
  }

  async function updatePrice(requestId: string, amount: number) {
    setBusy(requestId);
    try {
      await jsonRequest(`/api/professor/stickers/collection-purchases/${requestId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ xpAmount: amount }) });
      toast.success("Valor atualizado para os alunos.");
      router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível atualizar."); }
    finally { setBusy(null); }
  }

  async function cancel(requestId: string) {
    if (!confirm("Cancelar a compra e liberar todas as coleções oferecidas?")) return;
    setBusy(requestId);
    try {
      await jsonRequest(`/api/professor/stickers/collection-purchases/${requestId}`, { method: "DELETE" });
      toast.success("Compra cancelada; as figurinhas oferecidas foram liberadas.");
      router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível cancelar."); }
    finally { setBusy(null); }
  }

  async function draw(item: PurchaseRequest) {
    const participants = item.offers.filter(offer => offer.state === "ACTIVE").map(offer => offer.name);
    if (!participants.length) return;
    if (!confirm(`Sortear entre ${participants.length} oferta(s) e pagar ${item.xpAmount} XP ao aluno escolhido?`)) return;
    setBusy(item.id);
    try {
      const result = await jsonRequest(`/api/professor/stickers/collection-purchases/${item.id}/draw`, { method: "POST" });
      let tick = 0;
      await new Promise<void>(resolve => {
        const interval = window.setInterval(() => {
          setWheelName(current => ({ ...current, [item.id]: participants[tick % participants.length] }));
          tick += 1;
          if (tick >= 20) { window.clearInterval(interval); resolve(); }
        }, 90);
      });
      setWheelName(current => ({ ...current, [item.id]: result.winner.name }));
      toast.success(`${result.winner.name} foi sorteado e recebeu ${result.xpAmount} XP.`);
      router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível girar a roleta."); }
    finally { setBusy(null); }
  }

  return <div className="mt-7 space-y-7">
    <form onSubmit={create} className="glass grid gap-5 rounded-3xl p-5 md:grid-cols-[1.4fr_.7fr_auto] md:items-end sm:p-7">
      <label className="text-sm font-bold">Coleção
        <select className="input mt-2" value={collectionId} onChange={event => changeCollection(event.target.value)} disabled={!collections.length}>
          {collections.map(collection => <option key={collection.id} value={collection.id}>{collection.name} · {collection.stickerCount} figurinhas</option>)}
        </select>
      </label>
      <label className="text-sm font-bold">Pagamento em XP
        <input className="input mt-2" type="number" min={1} max={10_000} value={xpAmount} onChange={event => setXpAmount(Number(event.target.value))} required/>
        <span className="mt-2 block text-xs font-normal text-slate-500">Sugestão: {selectedCollection?.suggestedXp ?? 0} XP (soma do score da coleção).</span>
      </label>
      <button className="button-primary" disabled={!collections.length || busy === "create"}><CircleDollarSign size={18}/>{busy === "create" ? "Publicando…" : "Quero comprar"}</button>
    </form>

    <section>
      <div className="flex items-center gap-3"><Dices className="text-blue-300"/><div><h3 className="font-display text-2xl font-bold">Roletas abertas</h3><p className="text-sm text-slate-500">Somente ofertas completas e reservadas entram no sorteio.</p></div></div>
      <div className="mt-4 grid gap-5 xl:grid-cols-2">{openRequests.length ? openRequests.map(item => {
        const activeOffers = item.offers.filter(offer => offer.state === "ACTIVE");
        return <article key={item.id} className="glass rounded-3xl p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow">Compra aberta</p><h4 className="mt-2 font-display text-2xl font-bold">{item.collectionName}</h4><p className="mt-1 text-sm text-slate-400">Sugestão do sistema: {item.suggestedXp} XP</p></div><span className="rounded-full bg-blue-400/10 px-3 py-2 text-sm font-black text-blue-200">{item.xpAmount} XP</span></div>
          <div className="mt-5 rounded-2xl border border-blue-300/15 bg-slate-950/45 p-5 text-center"><p className="text-xs font-bold uppercase tracking-[.18em] text-slate-500">Roleta</p><p className="mt-3 min-h-9 font-display text-2xl font-black text-blue-200">{wheelName[item.id] ?? (activeOffers.length ? `${activeOffers.length} aluno(s) aguardando` : "Sem ofertas ainda")}</p><button type="button" className="button-primary mt-4" disabled={busy === item.id || !activeOffers.length} onClick={() => draw(item)}><Dices size={18}/>{busy === item.id ? "Girando…" : "Girar e comprar"}</button></div>
          <div className="mt-5"><p className="flex items-center gap-2 text-sm font-bold"><UsersRound size={17}/>Quem ofereceu</p><div className="mt-3 flex flex-wrap gap-2">{activeOffers.length ? activeOffers.map(offer => <span key={offer.id} className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300">{offer.name}</span>) : <span className="text-sm text-slate-500">Aguardando alunos com a coleção completa.</span>}</div></div>
          <form className="mt-5 flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); const amount = Number(new FormData(event.currentTarget).get("xpAmount")); void updatePrice(item.id, amount); }}><label className="min-w-40 flex-1 text-xs font-bold text-slate-400">Alterar valor<input className="input mt-2" name="xpAmount" type="number" min={1} max={10_000} defaultValue={item.xpAmount} required/></label><button className="button-secondary" disabled={busy === item.id}>Salvar XP</button><button type="button" className="button-secondary text-rose-300" disabled={busy === item.id} onClick={() => cancel(item.id)}><X size={16}/>Cancelar</button></form>
        </article>;
      }) : <p className="glass col-span-full rounded-2xl p-8 text-center text-sm text-slate-500">Nenhuma compra aberta.</p>}</div>
    </section>

    {history.length > 0 && <section><h3 className="font-display text-xl font-bold">Histórico recente</h3><div className="mt-4 space-y-3">{history.map(item => <article key={item.id} className="glass flex flex-wrap items-center gap-4 rounded-2xl p-4"><span className={`grid h-10 w-10 place-items-center rounded-full ${item.state === "COMPLETED" ? "bg-emerald-400/10 text-emerald-300" : "bg-slate-800 text-slate-500"}`}><Trophy size={18}/></span><div className="mr-auto"><p className="font-bold">{item.collectionName}</p><p className="text-xs text-slate-500">{item.purchase ? `${item.purchase.name} · ${item.purchase.xpAmount} XP` : "Compra cancelada"}</p></div><span className="text-xs text-slate-500">{new Date(item.purchase?.createdAt ?? item.createdAt).toLocaleString("pt-BR")}</span></article>)}</div></section>}
  </div>;
}
