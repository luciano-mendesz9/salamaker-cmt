import { TicTacToeRoom } from "@/components/tic-tac-toe-room";
import { requireStudent } from "@/lib/authorization";
import { getTicTacToeRoom } from "@/lib/tic-tac-toe-service";
export default async function TicTacToeRoomPage({ params }: { params: Promise<{ id: string }> }) { const [{ student }, { id }] = await Promise.all([requireStudent(), params]); const room = await getTicTacToeRoom(student.id, id); return <TicTacToeRoom initialRoom={room} studentId={student.id}/>; }
