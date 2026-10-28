import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudent } from "@/lib/authorization";
import { battleshipJsonError } from "@/lib/battleship-http";
import { publishBattleship } from "@/lib/battleship-realtime";
import { battleshipRoomDto, getBattleshipRoomPreview, joinBattleshipRoom } from "@/lib/battleship-service";
import { minigameTransaction } from "@/lib/minigame-transaction";
import { assertSameOrigin, consumeRateLimit } from "@/lib/request-security";
const input = z.object({ code: z.string().regex(/^\d{6}$/), expectedWager: z.number().int().min(10).max(500) });
export async function GET(request: Request) { try { const { student } = await requireStudent(); await consumeRateLimit(`battleship:preview:${student.id}`, 30, 10 * 60_000); const code = new URL(request.url).searchParams.get("code") ?? ""; return NextResponse.json({ preview: await getBattleshipRoomPreview(student.id, code) }); } catch (error) { return battleshipJsonError(error); } }
export async function POST(request: Request) { try { assertSameOrigin(request); const { student } = await requireStudent(); await consumeRateLimit(`battleship:join:${student.id}`, 15, 10 * 60_000); const body = input.parse(await request.json()); const room = await minigameTransaction((tx) => joinBattleshipRoom(tx, student.id, body.code, body.expectedWager)); await publishBattleship(room.id, "joined"); return NextResponse.json({ room: battleshipRoomDto(room, student.id) }); } catch (error) { return battleshipJsonError(error); } }
