import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudent } from "@/lib/authorization";
import { minigameTransaction } from "@/lib/minigame-transaction";
import { assertSameOrigin, consumeRateLimit } from "@/lib/request-security";
import { ticTacToeJsonError } from "@/lib/tic-tac-toe-http";
import { playTicTacToeSoloMove, ticTacToeSoloDto } from "@/lib/tic-tac-toe-solo-service";

const input = z.object({ cell: z.number().int().min(0).max(8), requestId: z.string().uuid() });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { student } = await requireStudent();
    await consumeRateLimit(`tic-tac-toe:solo:move:${student.id}`, 90, 10 * 60_000);
    const [{ id }, body] = await Promise.all([context.params, request.json().then((value) => input.parse(value))]);
    const result = await minigameTransaction((tx) => playTicTacToeSoloMove(tx, student.id, id, body.cell, body.requestId));
    return NextResponse.json({ game: ticTacToeSoloDto(result.game), replayed: result.replayed });
  } catch (error) { return ticTacToeJsonError(error); }
}
