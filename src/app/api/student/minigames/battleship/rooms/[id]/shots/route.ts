import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudent } from "@/lib/authorization";
import { battleshipJsonError } from "@/lib/battleship-http";
import { publishBattleship } from "@/lib/battleship-realtime";
import { battleshipRoomDto, fireBattleshipShot } from "@/lib/battleship-service";
import { minigameTransaction } from "@/lib/minigame-transaction";
import { assertSameOrigin, consumeRateLimit } from "@/lib/request-security";
const input = z.object({ cell: z.number().int().min(0).max(99), actionKey: z.string().uuid() });
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) { try { assertSameOrigin(request); const [{ student }, { id }, body] = await Promise.all([requireStudent(), context.params, request.json().then((value) => input.parse(value))]); await consumeRateLimit(`battleship:shot:${student.id}`, 120, 10 * 60_000); const room = await minigameTransaction((tx) => fireBattleshipShot(tx, student.id, id, body.cell, body.actionKey)); await publishBattleship(id, "shot"); return NextResponse.json({ room: battleshipRoomDto(room, student.id) }); } catch (error) { return battleshipJsonError(error); } }
