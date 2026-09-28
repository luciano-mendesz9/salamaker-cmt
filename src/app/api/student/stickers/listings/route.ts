import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireStudent } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { stickerPriceRange } from "@/lib/stickers";
import { assertSameOrigin, consumeRateLimit } from "@/lib/request-security";
import { requireCollectiblesSchema } from "@/lib/feature-readiness";
import { assertStickerMarketEnabled } from "@/lib/sticker-market";

const input = z.object({ copyId: z.string().uuid(), price: z.number().int().positive(), password: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const { student } = await requireStudent();
    await requireCollectiblesSchema();
    assertSameOrigin(request);
    await consumeRateLimit(`stickers:list:${student.id}`, 20, 10 * 60_000);
    const body = input.parse(await request.json());
    if (!(await compare(body.password, student.passwordHash))) return NextResponse.json({ message: "Senha atual incorreta." }, { status: 403 });
    const listing = await prisma.$transaction(async tx => {
      await assertStickerMarketEnabled(tx);
      const copy = await tx.stickerCopy.findFirstOrThrow({ where: { id: body.copyId, ownerId: student.id, state: "OWNED" }, include: { sticker: true } });
      const freeCopies = await tx.stickerCopy.count({ where: { ownerId: student.id, stickerId: copy.stickerId, state: "OWNED" } });
      if (freeCopies < 2) throw new Error("NOT_DUPLICATE");
      const range = stickerPriceRange(copy.sticker.rarity);
      if (body.price < range.min || body.price > range.max) throw new Error("PRICE_RANGE");
      const changed = await tx.stickerCopy.updateMany({ where: { id: copy.id, ownerId: student.id, state: "OWNED" }, data: { state: "ESCROW" } });
      if (changed.count !== 1) throw new Error("COPY_UNAVAILABLE");
      const created = await tx.stickerListing.create({ data: { copyId: copy.id, sellerId: student.id, price: body.price, expiresAt: new Date(Date.now() + 7 * 86_400_000) } });
      await tx.auditLog.create({ data: { actorId: student.id, targetId: student.id, event: "STICKER_LISTED", details: { listingId: created.id, stickerId: copy.stickerId, price: body.price } } });
      return created;
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ listing });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "Revise a cópia, o preço e a senha." }, { status: 400 });
    if (error instanceof Error && ["NOT_DUPLICATE", "PRICE_RANGE", "COPY_UNAVAILABLE"].includes(error.message)) return NextResponse.json({ message: error.message === "NOT_DUPLICATE" ? "Somente uma duplicata livre pode ser anunciada." : error.message === "PRICE_RANGE" ? "Preço fora da faixa permitida para a raridade." : "Esta cópia não está mais disponível." }, { status: 409 });
    const [message, status] = apiError(error); return NextResponse.json({ message }, { status });
  }
}
