type ShipKind = "carrier" | "battleship" | "cruiser" | "submarine" | "destroyer";

export function BattleshipShipSvg({ kind, className = "h-14 w-full" }: { kind: ShipKind; className?: string }) {
  const accent = kind === "carrier" ? "#67e8f9" : kind === "battleship" ? "#60a5fa" : kind === "submarine" ? "#a78bfa" : kind === "cruiser" ? "#34d399" : "#fbbf24";
  return <svg viewBox="0 0 180 60" role="img" aria-label={shipLabels[kind]} className={className}>
    <defs><linearGradient id={`hull-${kind}`} x1="0" x2="1"><stop stopColor="#172554"/><stop offset="1" stopColor="#0f172a"/></linearGradient></defs>
    <path d="M12 37 29 48h116l24-17-20 5H35Z" fill={`url(#hull-${kind})`} stroke={accent} strokeWidth="2"/>
    {kind === "carrier" && <><path d="M33 21h103l18 15H26Z" fill="#1e3a5f" stroke={accent}/><path d="M64 16h47v5H64Z" fill={accent} opacity=".65"/><path d="m89 8 9 8H79Z" fill={accent}/></>}
    {kind === "battleship" && <><path d="M55 26h65l12 10H43Z" fill="#1e3a5f" stroke={accent}/><path d="M76 15h28v11H76Z" fill="#334155" stroke={accent}/><path d="M83 8h3v8h-3Zm11 0h3v8h-3Z" fill={accent}/><circle cx="50" cy="30" r="5" fill={accent}/><circle cx="130" cy="30" r="5" fill={accent}/></>}
    {kind === "cruiser" && <><path d="M66 24h49l11 12H53Z" fill="#164e63" stroke={accent}/><path d="M82 14h19v10H82Z" fill="#334155" stroke={accent}/><path d="M90 7h3v8h-3Z" fill={accent}/></>}
    {kind === "submarine" && <><path d="M35 35c12-17 88-20 111 0Z" fill="#312e81" stroke={accent}/><path d="M79 18h26v10H79Z" fill="#312e81" stroke={accent}/><path d="M91 10v9h14" fill="none" stroke={accent} strokeWidth="3"/></>}
    {kind === "destroyer" && <><path d="M69 27h41l12 9H57Z" fill="#3f3f46" stroke={accent}/><path d="M83 18h15v9H83Z" fill="#334155" stroke={accent}/><path d="M90 11v8" stroke={accent} strokeWidth="3"/></>}
    <path d="M22 52c20-4 28 4 48 0s30 4 50 0 31 3 47-1" fill="none" stroke="#38bdf8" strokeWidth="2" opacity=".55"/>
  </svg>;
}

export const shipLabels: Record<ShipKind, string> = { carrier: "Porta-aviões", battleship: "Encouraçado", cruiser: "Cruzador", submarine: "Submarino", destroyer: "Contratorpedeiro" };
