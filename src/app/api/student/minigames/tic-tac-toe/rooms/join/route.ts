import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudent } from "@/lib/authorization";
import { minigameTransaction } from "@/lib/minigame-transaction";
import { assertSameOrigin, consumeRateLimit } from "@/lib/request-security";
import { ticTacToeJsonError } from "@/lib/tic-tac-toe-http";
import { publishTicTacToe } from "@/lib/tic-tac-toe-realtime";
import { joinTicTacToeRoom, ticTacToeRoomDto } from "@/lib/tic-tac-toe-service";

const input = z.object({ code: z.string().regex(/^\d{6}$/) });
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { student } = await requireStudent();
    await consumeRateLimit(`tic-tac-toe:join:${student.id}`, 15, 10 * 60_000);
    const body = input.parse(await request.json());
    const room = await minigameTransaction((tx) => joinTicTacToeRoom(tx, student.id, body.code));
    await publishTicTacToe(room.id, "joined");
    return NextResponse.json({ room: ticTacToeRoomDto(room, student.id) });
  } catch (error) { return ticTacToeJsonError(error); }
}
