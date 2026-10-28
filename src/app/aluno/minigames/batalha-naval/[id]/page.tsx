import { BattleshipRoom } from "@/components/battleship-room";
import { requireStudent } from "@/lib/authorization";
import { getBattleshipRoom } from "@/lib/battleship-service";
export default async function BattleshipRoomPage({ params }: { params: Promise<{ id: string }> }) { const [{ student }, { id }] = await Promise.all([requireStudent(), params]); const room = await getBattleshipRoom(student.id, id); return <BattleshipRoom initialRoom={room} studentId={student.id}/>; }
