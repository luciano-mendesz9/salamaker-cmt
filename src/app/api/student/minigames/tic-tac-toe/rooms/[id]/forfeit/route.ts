import { NextResponse } from "next/server";
import { requireStudent } from "@/lib/authorization";
import { minigameTransaction } from "@/lib/minigame-transaction";
import { assertSameOrigin } from "@/lib/request-security";
import { ticTacToeJsonError } from "@/lib/tic-tac-toe-http";
import { publishTicTacToe } from "@/lib/tic-tac-toe-realtime";
import { forfeitTicTacToeRoom, ticTacToeRoomDto } from "@/lib/tic-tac-toe-service";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try { assertSameOrigin(request); const [{ student }, { id }] = await Promise.all([requireStudent(), context.params]); const room = await minigameTransaction((tx) => forfeitTicTacToeRoom(tx, student.id, id)); await publishTicTacToe(id, "forfeit"); return NextResponse.json({ room: ticTacToeRoomDto(room, student.id) }); }
  catch (error) { return ticTacToeJsonError(error); }
}
