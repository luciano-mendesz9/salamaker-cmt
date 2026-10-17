import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudent } from "@/lib/authorization";
import { minigameTransaction } from "@/lib/minigame-transaction";
import { assertSameOrigin, consumeRateLimit } from "@/lib/request-security";
import { publishTicTacToe } from "@/lib/tic-tac-toe-realtime";
import { createTicTacToeRoom, getTicTacToeLobby, makeTicTacToeCode, ticTacToeRoomDto } from "@/lib/tic-tac-toe-service";
import { ticTacToeJsonError } from "@/lib/tic-tac-toe-http";

const input = z.object({ wager: z.number().int().min(11).max(500), requestId: z.string().uuid() });

export async function GET() {
  try { const { student } = await requireStudent(); return NextResponse.json(await getTicTacToeLobby(student.id)); }
  catch (error) { return ticTacToeJsonError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { student } = await requireStudent();
    await consumeRateLimit(`tic-tac-toe:create:${student.id}`, 10, 10 * 60_000);
    const body = input.parse(await request.json());
    let result: Awaited<ReturnType<typeof createTicTacToeRoom>> | null = null;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try { result = await minigameTransaction((tx) => createTicTacToeRoom(tx, student.id, body.wager, body.requestId, makeTicTacToeCode())); break; }
      catch (error) { if ((error as { code?: string }).code === "P2002" && attempt < 5) continue; throw error; }
    }
    if (!result) throw new Error("ROOM_CODE_EXHAUSTED");
    await publishTicTacToe(result.room.id, "created");
    return NextResponse.json({ room: ticTacToeRoomDto(result.room, student.id), replayed: result.replayed }, { status: result.replayed ? 200 : 201 });
  } catch (error) { return ticTacToeJsonError(error); }
}
