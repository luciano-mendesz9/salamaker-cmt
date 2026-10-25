import { NextResponse } from "next/server";
import { applyMonthlyXpAdjustment } from "@/lib/xp-adjustment";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  }

  try {
    return NextResponse.json(await applyMonthlyXpAdjustment());
  } catch (error) {
    console.error("Monthly XP adjustment failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ message: "Não foi possível concluir o ajuste mensal de XP." }, { status: 500 });
  }
}
