import { requireStudent } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { ticTacToeJsonError } from "@/lib/tic-tac-toe-http";
import { subscribeTicTacToe } from "@/lib/tic-tac-toe-realtime";
import { TicTacToeError } from "@/lib/tic-tac-toe-service";
export const maxDuration = 300;
export async function GET(request: Request) {
  try {
    const { student } = await requireStudent();
    const roomId = new URL(request.url).searchParams.get("roomId");
    if (!roomId) throw new TicTacToeError("ROOM_NOT_FOUND");
    const member = await prisma.ticTacToeRoom.findFirst({ where: { id: roomId, OR: [{ ownerId: student.id }, { guestId: student.id }] }, select: { id: true } });
    if (!member) throw new TicTacToeError("NOT_A_PLAYER");
    const encoder = new TextEncoder(); let controller: ReadableStreamDefaultController<Uint8Array> | null = null; let closed = false;
    const send = (encoded: string) => { if (!closed && controller) try { controller.enqueue(encoder.encode(`data: ${encoded}\n\n`)); } catch {} };
    const closeSubscription = await subscribeTicTacToe(roomId, send);
    const heartbeat = setInterval(() => send(JSON.stringify({ type: "heartbeat", occurredAt: new Date().toISOString() })), 15_000);
    const cleanup = async () => { if (closed) return; closed = true; clearInterval(heartbeat); await closeSubscription(); try { controller?.close(); } catch {} };
    const stream = new ReadableStream<Uint8Array>({ start(value) { controller = value; send(JSON.stringify({ type: "ready", occurredAt: new Date().toISOString() })); }, cancel() { void cleanup(); } });
    request.signal.addEventListener("abort", () => void cleanup(), { once: true });
    return new Response(stream, { headers: { "Cache-Control": "no-cache, no-transform", "Content-Type": "text/event-stream; charset=utf-8", "X-Accel-Buffering": "no" } });
  } catch (error) { return ticTacToeJsonError(error); }
}
