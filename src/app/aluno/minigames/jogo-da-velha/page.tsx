import { GamesDisabled } from "@/components/games-disabled";
import { TicTacToeLobby } from "@/components/tic-tac-toe-lobby";
import { requireStudent } from "@/lib/authorization";
import { getTicTacToeLobby } from "@/lib/tic-tac-toe-service";
export default async function TicTacToePage() { const { student } = await requireStudent(); const lobby = await getTicTacToeLobby(student.id); if (!lobby.gamesEnabled) return <GamesDisabled/>; return <TicTacToeLobby initial={lobby} studentName={student.firstName}/>; }
