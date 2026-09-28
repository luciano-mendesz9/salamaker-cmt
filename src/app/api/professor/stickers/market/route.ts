import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireTeacher } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { requireCollectiblesSchema } from "@/lib/feature-readiness";
import { assertSameOrigin, consumeRateLimit } from "@/lib/request-security";

const input = z.object({ enabled: z.boolean() });

export async function PATCH(request: Request) {
  try {
    const teacher = await requireTeacher();
    await requireCollectiblesSchema();
    assertSameOrigin(request);
    await consumeRateLimit(`stickers:market-setting:${teacher.id}`, 20, 10 * 60_000);
    const body = input.parse(await request.json());
    const setting = await prisma.$transaction(async tx => {
      const updated = await tx.stickerMarketSetting.upsert({
        where: { id: 1 },
        create: { id: 1, enabled: body.enabled },
        update: { enabled: body.enabled },
      });
      await tx.auditLog.create({
        data: {
          actorId: teacher.id,
          event: "MODERATION_CHANGED",
          details: { stickerMarketEnabled: body.enabled },
        },
      });
      return updated;
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ enabled: setting.enabled });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "Estado do mercado inválido." }, { status: 400 });
    const [message, status] = apiError(error);
    return NextResponse.json({ message }, { status });
  }
}
