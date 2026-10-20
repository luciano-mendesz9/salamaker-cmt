"use client";

import { useMemo, useState } from "react";
import { Coins, History, Zap } from "lucide-react";

type LedgerRow = {
  id: string;
  delta: number;
  reason: string;
  source: string;
  idempotencyKey: string;
  createdAt: string;
  author: string | null;
  context: string | null;
};

type Category = { value: string; label: string };

const xpCategories: Category[] = [
  { value: "access", label: "Acesso" },
  { value: "attendance", label: "Presença" },
  { value: "behavior", label: "Comportamento" },
  { value: "activity", label: "Atividade" },
  { value: "transfer", label: "Transferência" },
  { value: "pong", label: "Pong" },
  { value: "tic-tac-toe", label: "Jogo da velha" },
  { value: "sudoku", label: "Sudoku" },
  { value: "ludo", label: "Ludo Maker" },
  { value: "shop", label: "Loja e coleções" },
  { value: "adjustment", label: "Ajuste manual ou sistema" },
  { value: "other", label: "Outros" },
];

const devCoinCategories: Category[] = [
  { value: "conversion", label: "Conversão de XP" },
  { value: "teacher", label: "Envio do professor" },
  { value: "initial", label: "Crédito inicial" },
  { value: "transfer", label: "Transferência" },
  { value: "pong", label: "Pong" },
  { value: "tic-tac-toe", label: "Jogo da velha" },
  { value: "sudoku", label: "Sudoku" },
  { value: "ludo", label: "Ludo Maker" },
  { value: "shop", label: "Loja e coleções" },
  { value: "other", label: "Outros" },
];

function xpCategory(row: LedgerRow) {
  const text = `${row.reason} ${row.idempotencyKey}`.toLowerCase();
  if (text.includes("daily-login") || text.includes("acesso diário") || text.includes("primeiro acesso")) return "access";
  if (row.source === "ATTENDANCE") return "attendance";
  if (row.source === "BEHAVIOR") return "behavior";
  if (row.source === "ACTIVITY") return "activity";
  if (row.source === "DEV_COIN_TRANSFER") return "transfer";
  if (row.source === "PONG_RESULT") return "pong";
  if (row.source === "TIC_TAC_TOE_RESULT") return "tic-tac-toe";
  if (row.source === "SUDOKU_RESULT") return "sudoku";
  if (row.source.startsWith("LUDO_")) return "ludo";
  if (["PROFILE_AVATAR", "DEV_COIN_PURCHASE", "STICKER_COLLECTION_SALE"].includes(row.source)) return "shop";
  if (["MANUAL", "BULK", "SYSTEM"].includes(row.source)) return "adjustment";
  return "other";
}

function devCoinCategory(row: LedgerRow) {
  if (row.source === "PURCHASE") return "conversion";
  if (row.source === "TEACHER_GRANT") return "teacher";
  if (row.source === "INITIAL_GRANT") return "initial";
  if (row.source.startsWith("TRANSFER_")) return "transfer";
  if (row.source.startsWith("PONG_")) return "pong";
  if (row.source.startsWith("TIC_TAC_TOE_")) return "tic-tac-toe";
  if (row.source.startsWith("SUDOKU_")) return "sudoku";
  if (row.source.startsWith("LUDO_")) return "ludo";
  if (["PROFILE_AVATAR", "STICKER_PACK", "STICKER_MARKET", "PATENT_REWARD"].includes(row.source)) return "shop";
  return "other";
}

export function StudentLedgerHistory({ xp, devCoins }: { xp: LedgerRow[]; devCoins: LedgerRow[] }) {
  const [xpFilter, setXpFilter] = useState("all");
  const [devCoinFilter, setDevCoinFilter] = useState("all");
  const visibleXp = useMemo(() => xp.filter((row) => xpFilter === "all" || xpCategory(row) === xpFilter), [xp, xpFilter]);
  const visibleDevCoins = useMemo(() => devCoins.filter((row) => devCoinFilter === "all" || devCoinCategory(row) === devCoinFilter), [devCoins, devCoinFilter]);
  const availableXp = new Set<string>(xp.map(xpCategory));
  const availableDevCoins = new Set<string>(devCoins.map(devCoinCategory));

  return <div className="mt-7 grid gap-6 xl:grid-cols-2">
    <LedgerList title="Histórico de XP" unit="XP" icon={Zap} rows={visibleXp} total={xp.length} filter={xpFilter} setFilter={setXpFilter} categories={xpCategories.filter((category) => availableXp.has(category.value))} tone="blue" />
    <LedgerList title="Histórico de Dev-Coins" unit="DC" icon={Coins} rows={visibleDevCoins} total={devCoins.length} filter={devCoinFilter} setFilter={setDevCoinFilter} categories={devCoinCategories.filter((category) => availableDevCoins.has(category.value))} tone="amber" />
  </div>;
}

function LedgerList({ title, unit, icon: Icon, rows, total, filter, setFilter, categories, tone }: { title: string; unit: string; icon: typeof Zap; rows: LedgerRow[]; total: number; filter: string; setFilter: (value: string) => void; categories: Category[]; tone: "blue" | "amber" }) {
  return <section className="glass overflow-hidden rounded-2xl">
    <div className="border-b border-slate-700 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3"><span className={`grid h-11 w-11 place-items-center rounded-xl ${tone === "blue" ? "bg-blue-400/10 text-blue-300" : "bg-amber-300/10 text-amber-300"}`}><Icon size={21} /></span><div><h3 className="font-display text-lg font-bold">{title}</h3><p className="text-xs text-slate-400">{total} lançamento(s) no ledger</p></div></div>
        <label className="text-xs font-bold text-slate-400">Tipo de ganho ou movimentação<select value={filter} onChange={(event) => setFilter(event.target.value)} className="input mt-2 min-w-52 text-sm"><option value="all">Todos</option>{categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label>
      </div>
    </div>
    <div className="max-h-[680px] overflow-y-auto">
      {rows.length ? rows.map((row) => <article key={row.id} className="grid gap-3 border-b border-slate-800 p-5 last:border-0 sm:grid-cols-[1fr_auto]">
        <div><p className="font-bold text-slate-100">{row.reason}</p><p className="mt-2 text-xs text-slate-500">{row.context ?? "Sem contexto adicional"}{row.author ? ` · por ${row.author}` : " · sistema"}</p><p className="mt-1 text-xs text-slate-600">{new Date(row.createdAt).toLocaleString("pt-BR")}</p></div>
        <strong className={`sm:text-right ${row.delta >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{row.delta >= 0 ? "+" : ""}{row.delta} {unit}</strong>
      </article>) : <div className="p-10 text-center"><History className="mx-auto text-slate-600" /><p className="mt-3 text-sm text-slate-500">Nenhum lançamento encontrado neste filtro.</p></div>}
    </div>
  </section>;
}
