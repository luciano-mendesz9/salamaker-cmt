import { redirect } from "next/navigation";
import { GamesDisabled } from "@/components/games-disabled";
import { requireStudent } from "@/lib/authorization";
import { prisma } from "@/lib/db";

export default async function GamesAliasPage() {
  await requireStudent();
  const settings = await prisma.appSetting.upsert({ where: { id: 1 }, create: { id: 1 }, update: {}, select: { gamesEnabled: true } });
  if (!settings.gamesEnabled) return <GamesDisabled/>;
  redirect("/aluno/minigames");
}
