import { NextResponse } from "next/server";
import { requireStudent } from "@/lib/authorization";
import { battleshipJsonError } from "@/lib/battleship-http";
import { publishBattleship } from "@/lib/battleship-realtime";
import { battleshipRoomDto, cancelBattleshipRoom } from "@/lib/battleship-service";
import { minigameTransaction } from "@/lib/minigame-transaction";
import { assertSameOrigin } from "@/lib/request-security";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) { try { assertSameOrigin(request); const [{ student }, { id }] = await Promise.all([requireStudent(), context.params]); const room = await minigameTransaction((tx) => cancelBattleshipRoom(tx, student.id, id)); await publishBattleship(id, "cancelled"); return NextResponse.json({ room: battleshipRoomDto(room, student.id) }); } catch (error) { return battleshipJsonError(error); } }
