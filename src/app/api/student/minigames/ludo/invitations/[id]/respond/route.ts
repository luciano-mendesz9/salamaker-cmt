import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudent } from "@/lib/authorization";
import { ludoApiError, ludoTransaction } from "@/lib/ludo-api";
import { publishLudoEvent, roomChannel, userChannel } from "@/lib/ludo-realtime";
import { respondToLudoInvitation } from "@/lib/ludo-service";
import { assertSameOrigin } from "@/lib/request-security";
const input = z.object({ accept: z.boolean(), block: z.boolean().default(false) }).refine(value => !(value.accept && value.block));
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { student } = await requireStudent(); assertSameOrigin(request); const { id } = await params; const body = input.parse(await request.json());
    const result = await ludoTransaction(tx => respondToLudoInvitation(tx, student.id, id, body.accept, body.block));
    await publishLudoEvent(roomChannel(result.room.id), { type: "room", roomId: result.room.id, userId: student.id, payload: { action: result.accepted ? "invitation-accepted" : "invitation-declined" } });
    await publishLudoEvent(userChannel(result.room.ownerId), { type: "invitation", roomId: result.room.id, payload: { action: result.accepted ? "accepted" : "declined", studentName: `${student.firstName} ${student.lastName}` } });
    return NextResponse.json({ accepted: result.accepted, room: { id: result.room.id, code: result.room.code } });
  } catch (error) { return ludoApiError(error); }
}
