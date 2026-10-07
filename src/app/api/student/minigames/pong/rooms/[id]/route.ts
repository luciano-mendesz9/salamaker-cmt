import { NextResponse } from "next/server";
import { requireStudent } from "@/lib/authorization";
import { pongJsonError } from "@/lib/pong-http";
import { getPongRoomForStudent } from "@/lib/pong-service";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { student } = await requireStudent();
    const { id } = await context.params;
    return NextResponse.json({ room: await getPongRoomForStudent(student.id, id) });
  } catch (error) {
    return pongJsonError(error);
  }
}
