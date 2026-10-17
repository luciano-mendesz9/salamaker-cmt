import { NextResponse } from "next/server";
import { requireStudent } from "@/lib/authorization";
import { ticTacToeJsonError } from "@/lib/tic-tac-toe-http";
import { getTicTacToeRoom } from "@/lib/tic-tac-toe-service";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { const [{ student }, { id }] = await Promise.all([requireStudent(), context.params]); return NextResponse.json({ room: await getTicTacToeRoom(student.id, id) }); }
  catch (error) { return ticTacToeJsonError(error); }
}
