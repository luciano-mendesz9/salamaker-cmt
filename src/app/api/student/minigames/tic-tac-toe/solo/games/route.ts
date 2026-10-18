import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudent } from "@/lib/authorization";
import { minigameTransaction } from "@/lib/minigame-transaction";
import { assertSameOrigin, consumeRateLimit } from "@/lib/request-security";
import { ticTacToeJsonError } from "@/lib/tic-tac-toe-http";
import { createTicTacToeSoloGame, ticTacToeSoloDto } from "@/lib/tic-tac-toe-solo-service";

const input = z.object({ requestId: z.string().uuid() });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { student } = await requireStudent();
    await consumeRateLimit(`tic-tac-toe:solo:create:${student.id}`, 20, 10 * 60_000);
    const body = input.parse(await request.json());
    const result = await minigameTransaction((tx) => createTicTacToeSoloGame(tx, student.id, body.requestId));
    return NextResponse.json({ game: ticTacToeSoloDto(result.game), replayed: result.replayed }, { status: result.replayed ? 200 : 201 });
  } catch (error) { return ticTacToeJsonError(error); }
}
