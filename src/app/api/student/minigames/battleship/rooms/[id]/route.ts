import { NextResponse } from "next/server";
import { requireStudent } from "@/lib/authorization";
import { battleshipJsonError } from "@/lib/battleship-http";
import { getBattleshipRoom } from "@/lib/battleship-service";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) { try { const [{ student }, { id }] = await Promise.all([requireStudent(), context.params]); return NextResponse.json({ room: await getBattleshipRoom(student.id, id) }); } catch (error) { return battleshipJsonError(error); } }
