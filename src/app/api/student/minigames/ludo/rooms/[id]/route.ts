import { NextResponse } from "next/server";
import { requireStudent } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { ludoApiError, ludoRoomDto } from "@/lib/ludo-api";
import { getLudoRoom } from "@/lib/ludo-service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { student } = await requireStudent(); const { id } = await params; return NextResponse.json({ room: ludoRoomDto(await getLudoRoom(prisma, student.id, id), student.id) }); }
  catch (error) { return ludoApiError(error); }
}
