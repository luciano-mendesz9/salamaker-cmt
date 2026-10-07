import { GamesDisabled } from "@/components/games-disabled";
import { PongLobby } from "@/components/pong-lobby";
import { requireStudent } from "@/lib/authorization";
import { getPongLobby } from "@/lib/pong-service";

export default async function MinigamesPage() {
  const { student } = await requireStudent();
  const lobby = await getPongLobby(student.id);
  if (!lobby.gamesEnabled) return <GamesDisabled/>;
  return <PongLobby initial={lobby} studentName={student.firstName}/>;
}
