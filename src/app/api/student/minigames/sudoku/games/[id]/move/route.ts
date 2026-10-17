import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudent } from "@/lib/authorization";
import { minigameTransaction } from "@/lib/minigame-transaction";
import { assertSameOrigin } from "@/lib/request-security";
import { sudokuJsonError } from "@/lib/sudoku-http";
import { playSudokuValue, sudokuGameDto } from "@/lib/sudoku-service";
const input = z.object({ cell: z.number().int().min(0).max(80), value: z.number().int().min(1).max(9), requestId: z.string().uuid() });
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try { assertSameOrigin(request); const [{ student }, { id }, body] = await Promise.all([requireStudent(), context.params, request.json().then((value) => input.parse(value))]); const game = await minigameTransaction((tx) => playSudokuValue(tx, student.id, id, body.cell, body.value, body.requestId)); return NextResponse.json({ game: sudokuGameDto(game) }); }
  catch (error) { return sudokuJsonError(error); }
}
