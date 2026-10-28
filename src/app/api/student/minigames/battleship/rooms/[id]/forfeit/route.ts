import { NextResponse } from "next/server";
import { requireStudent } from "@/lib/authorization";
import { battleshipJsonError } from "@/lib/battleship-http";
import { publishBattleship } from "@/lib/battleship-realtime";
import { battleshipRoomDto, forfeitBattleshipRoom } from "@/lib/battleship-service";
import { minigameTransaction } from "@/lib/minigame-transaction";
import { assertSameOrigin } from "@/lib/request-security";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) { try { assertSameOrigin(request); const [{ student }, { id }] = await Promise.all([requireStudent(), context.params]); const room = await minigameTransaction((tx) => forfeitBattleshipRoom(tx, student.id, id)); await publishBattleship(id, "forfeit"); return NextResponse.json({ room: battleshipRoomDto(room, student.id) }); } catch (error) { return battleshipJsonError(error); } }
