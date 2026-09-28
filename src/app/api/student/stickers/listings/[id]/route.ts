import { NextResponse } from "next/server";
import { apiError, requireStudent } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { assertSameOrigin, consumeRateLimit } from "@/lib/request-security";
import { requireCollectiblesSchema } from "@/lib/feature-readiness";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { student } = await requireStudent();
    await requireCollectiblesSchema();
    assertSameOrigin(request);
    await consumeRateLimit(`stickers:cancel-listing:${student.id}`, 20, 10 * 60_000);
    const { id } = await context.params;
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "StickerListing" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const listing = await tx.stickerListing.findFirstOrThrow({ where: { id, sellerId: student.id, state: "ACTIVE" } });
      await tx.stickerListing.update({ where: { id }, data: { state: "CANCELLED", settledAt: new Date() } });
      await tx.stickerCopy.update({ where: { id: listing.copyId }, data: { state: "OWNED" } });
      await tx.auditLog.create({ data: { actorId: student.id, targetId: student.id, event: "STICKER_LISTED", details: { listingId: id, state: "CANCELLED" } } });
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ cancelled: true });
  } catch (error) {
    const [message, status] = apiError(error);
    return NextResponse.json({ message }, { status });
  }
}
