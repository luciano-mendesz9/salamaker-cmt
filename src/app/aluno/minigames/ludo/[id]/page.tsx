import { notFound } from "next/navigation";
import { LudoRoomClient } from "@/components/ludo-room";
import { requireStudent } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { ludoRoomDto } from "@/lib/ludo-api";
import { getLudoRoom } from "@/lib/ludo-service";

export default async function LudoRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { student } = await requireStudent(); const { id } = await params;
  const room = await getLudoRoom(prisma, student.id, id).catch(() => null);
  if (!room) notFound();
  return <LudoRoomClient initialRoom={ludoRoomDto(room, student.id)} viewerId={student.id}/>;
}
