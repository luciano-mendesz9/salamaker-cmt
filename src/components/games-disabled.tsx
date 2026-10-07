import { PowerOff } from "lucide-react";

export function GamesDisabled() {
  return <main className="mesh grid min-h-screen place-items-center p-5"><section className="glass max-w-lg rounded-3xl p-8 text-center"><PowerOff className="mx-auto text-rose-300" size={42}/><h1 className="mt-5 font-display text-2xl font-bold">Os minigames foram desativados pelo professor.</h1><p className="mt-3 text-sm leading-relaxed text-slate-400">Quando o acesso for reativado, a aba de minigames ficará disponível novamente.</p></section></main>;
}
