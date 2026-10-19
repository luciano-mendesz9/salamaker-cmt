import { requireStudent } from "@/lib/authorization";
import { LudoLobby } from "@/components/ludo-lobby";
export default async function LudoLobbyPage({ searchParams }: { searchParams: Promise<{ codigo?: string }> }) { const { student } = await requireStudent(); const query = await searchParams; return <LudoLobby initialCode={query.codigo?.toUpperCase().slice(0, 6) ?? ""} student={{ id: student.id, firstName: student.firstName, xp: student.xp, devCoins: student.devCoins }}/>; }
