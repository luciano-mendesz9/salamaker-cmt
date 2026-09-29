import { NextResponse } from "next/server";
import { apiError, requireStudent } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { requireCollectiblesSchema } from "@/lib/feature-readiness";

export async function GET() {
  try {
    await requireStudent();
    await requireCollectiblesSchema();
    const setting = await prisma.stickerMarketSetting.findUnique({
      where: { id: 1 },
      select: { enabled: true, updatedAt: true },
    });
    return NextResponse.json({
      enabled: setting?.enabled ?? false,
      updatedAt: setting?.updatedAt ?? null,
    });
  } catch (error) {
    const [message, status] = apiError(error);
    return NextResponse.json({ message }, { status });
  }
}
