import { PongRoom } from "@/components/pong-room";
import { requireStudent } from "@/lib/authorization";
import { getPongRoomForStudent } from "@/lib/pong-service";

export default async function PongRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ student }, { id }] = await Promise.all([requireStudent(), params]);
  const room = await getPongRoomForStudent(student.id, id);
  return <PongRoom initialRoom={room} studentId={student.id}/>;
}
