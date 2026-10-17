import { SudokuGame } from "@/components/sudoku-game";
import { requireStudent } from "@/lib/authorization";
import { getSudokuGame } from "@/lib/sudoku-service";
export default async function SudokuGamePage({ params }: { params: Promise<{ id: string }> }) { const [{ student }, { id }] = await Promise.all([requireStudent(), params]); const game = await getSudokuGame(student.id, id); return <SudokuGame initialGame={game}/>; }
