import { BattleshipLobby } from "@/components/battleship-lobby";
import { GamesDisabled } from "@/components/games-disabled";
import { requireStudent } from "@/lib/authorization";
import { getBattleshipLobby } from "@/lib/battleship-service";
export const metadata = { title: "Batalha Naval" };
export default async function BattleshipPage() { const { student } = await requireStudent(); const lobby = await getBattleshipLobby(student.id); if (!lobby.gamesEnabled) return <GamesDisabled/>; return <BattleshipLobby initial={lobby} studentName={student.firstName}/>; }
