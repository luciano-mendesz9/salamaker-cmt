import { NextResponse } from "next/server";
import { requireStudent } from "@/lib/authorization";
import { sudokuJsonError } from "@/lib/sudoku-http";
import { getSudokuGame } from "@/lib/sudoku-service";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { const [{ student }, { id }] = await Promise.all([requireStudent(), context.params]); return NextResponse.json({ game: await getSudokuGame(student.id, id) }); }
  catch (error) { return sudokuJsonError(error); }
}
