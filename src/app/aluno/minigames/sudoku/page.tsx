import { GamesDisabled } from "@/components/games-disabled";
import { SudokuHome } from "@/components/sudoku-home";
import { requireStudent } from "@/lib/authorization";
import { getSudokuHome } from "@/lib/sudoku-service";
export default async function SudokuPage() { const { student } = await requireStudent(); const home = await getSudokuHome(student.id); if (!home.gamesEnabled) return <GamesDisabled/>; return <SudokuHome initial={home} studentName={student.firstName}/>; }
