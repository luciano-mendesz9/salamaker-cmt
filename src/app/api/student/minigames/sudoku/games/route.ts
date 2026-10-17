import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudent } from "@/lib/authorization";
import { minigameTransaction } from "@/lib/minigame-transaction";
import { assertSameOrigin, consumeRateLimit } from "@/lib/request-security";
import { sudokuJsonError } from "@/lib/sudoku-http";
import { createSudokuGame, getSudokuHome, sudokuGameDto } from "@/lib/sudoku-service";
const input = z.object({ difficulty: z.enum(["EASY", "MEDIUM", "HARD", "EXPERT", "MASTER"]) });
export async function GET() {
  try { const { student } = await requireStudent(); return NextResponse.json(await getSudokuHome(student.id)); }
  catch (error) { return sudokuJsonError(error); }
}
export async function POST(request: Request) {
  try { assertSameOrigin(request); const { student } = await requireStudent(); await consumeRateLimit(`sudoku:create:${student.id}`, 20, 10 * 60_000); const body = input.parse(await request.json()); const game = await minigameTransaction((tx) => createSudokuGame(tx, student.id, body.difficulty)); return NextResponse.json({ game: sudokuGameDto(game) }, { status: 201 }); }
  catch (error) { return sudokuJsonError(error); }
}
