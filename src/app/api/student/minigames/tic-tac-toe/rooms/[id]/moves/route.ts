import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudent } from "@/lib/authorization";
import { minigameTransaction } from "@/lib/minigame-transaction";
import { assertSameOrigin } from "@/lib/request-security";
import { ticTacToeJsonError } from "@/lib/tic-tac-toe-http";
import { publishTicTacToe } from "@/lib/tic-tac-toe-realtime";
import { playTicTacToeMove, ticTacToeRoomDto } from "@/lib/tic-tac-toe-service";
const input = z.object({ cell: z.number().int().min(0).max(8) });
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try { assertSameOrigin(request); const [{ student }, { id }, body] = await Promise.all([requireStudent(), context.params, request.json().then((value) => input.parse(value))]); const room = await minigameTransaction((tx) => playTicTacToeMove(tx, student.id, id, body.cell)); await publishTicTacToe(id, "move"); return NextResponse.json({ room: ticTacToeRoomDto(room, student.id) }); }
  catch (error) { return ticTacToeJsonError(error); }
}
