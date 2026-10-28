import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudent } from "@/lib/authorization";
import { battleshipJsonError } from "@/lib/battleship-http";
import { publishBattleship } from "@/lib/battleship-realtime";
import { battleshipRoomDto, createBattleshipRoom, getBattleshipLobby, makeBattleshipCode } from "@/lib/battleship-service";
import { minigameTransaction } from "@/lib/minigame-transaction";
import { assertSameOrigin, consumeRateLimit } from "@/lib/request-security";

const input = z.object({ wager: z.number().int().min(10).max(500).refine((value) => value % 5 === 0), requestId: z.string().uuid() });
export async function GET() { try { const { student } = await requireStudent(); return NextResponse.json(await getBattleshipLobby(student.id)); } catch (error) { return battleshipJsonError(error); } }
export async function POST(request: Request) {
  try {
    assertSameOrigin(request); const { student } = await requireStudent(); await consumeRateLimit(`battleship:create:${student.id}`, 10, 10 * 60_000); const body = input.parse(await request.json());
    let result: Awaited<ReturnType<typeof createBattleshipRoom>> | null = null;
    for (let attempt = 0; attempt < 6; attempt += 1) { try { result = await minigameTransaction((tx) => createBattleshipRoom(tx, student.id, body.wager, body.requestId, makeBattleshipCode())); break; } catch (error) { if ((error as { code?: string }).code === "P2002" && attempt < 5) continue; throw error; } }
    if (!result) throw new Error("ROOM_CODE_EXHAUSTED");
    await publishBattleship(result.room.id, "created");
    return NextResponse.json({ room: battleshipRoomDto(result.room, student.id), replayed: result.replayed }, { status: result.replayed ? 200 : 201 });
  } catch (error) { return battleshipJsonError(error); }
}
