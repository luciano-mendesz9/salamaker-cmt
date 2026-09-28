import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireStudent } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { recalculatePatent } from "@/lib/sticker-transactions";
import { assertSameOrigin, consumeRateLimit } from "@/lib/request-security";
import { requireCollectiblesSchema } from "@/lib/feature-readiness";

const input = z.object({ action: z.enum(["ACCEPT", "DECLINE"]) });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { student } = await requireStudent();
    await requireCollectiblesSchema();
    assertSameOrigin(request);
    await consumeRateLimit(`stickers:donation-response:${student.id}`, 20, 10 * 60_000);
    const { id } = await context.params;
    const body = input.parse(await request.json());
    const result = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "StickerDonation" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const donation = await tx.stickerDonation.findFirstOrThrow({ where: { id, recipientId: student.id, state: "PENDING" }, include: { copy: { include: { sticker: true } } } });
      if (donation.expiresAt <= new Date()) {
        await tx.stickerDonation.update({ where: { id }, data: { state: "EXPIRED", resolvedAt: new Date() } });
        await tx.stickerCopy.update({ where: { id: donation.copyId }, data: { state: "OWNED" } });
        return { state: "EXPIRED" };
      }
      if (body.action === "DECLINE") {
        await tx.stickerDonation.update({ where: { id }, data: { state: "DECLINED", resolvedAt: new Date() } });
        await tx.stickerCopy.update({ where: { id: donation.copyId }, data: { state: "OWNED" } });
        await tx.auditLog.create({ data: { actorId: student.id, targetId: donation.senderId, event: "STICKER_DONATED", details: { donationId: id, state: "DECLINED" } } });
        return { state: "DECLINED" };
      }
      if (await tx.stickerCopy.count({ where: { ownerId: student.id, stickerId: donation.copy.stickerId } })) throw new Error("ALREADY_OWNED");
      const sender = await tx.user.updateMany({ where: { id: donation.senderId, role: "STUDENT", status: "ACTIVE", xp: { gte: 5 } }, data: { xp: { decrement: 5 } } });
      const recipient = await tx.user.updateMany({ where: { id: student.id, role: "STUDENT", status: "ACTIVE", xp: { gte: 20 } }, data: { xp: { decrement: 20 } } });
      if (sender.count !== 1 || recipient.count !== 1) throw new Error("INSUFFICIENT_XP");
      await tx.xpEntry.create({ data: { studentId: donation.senderId, delta: -5, reason: `Doação da figurinha ${donation.copy.sticker.name}`, source: "SYSTEM", idempotencyKey: `sticker-donation:${id}:sender` } });
      await tx.xpEntry.create({ data: { studentId: student.id, delta: -20, reason: `Aceite da figurinha ${donation.copy.sticker.name}`, source: "SYSTEM", idempotencyKey: `sticker-donation:${id}:recipient` } });
      await tx.stickerCopy.update({ where: { id: donation.copyId }, data: { ownerId: student.id, state: "OWNED", acquiredAt: new Date() } });
      await tx.stickerDonation.update({ where: { id }, data: { state: "ACCEPTED", resolvedAt: new Date() } });
      await tx.auditLog.create({ data: { actorId: student.id, targetId: donation.senderId, event: "STICKER_DONATED", details: { donationId: id, state: "ACCEPTED", senderXp: -5, recipientXp: -20 } } });
      await recalculatePatent(tx, student.id);
      return { state: "ACCEPTED" };
    }, { isolationLevel: "Serializable" });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({message:"Ação inválida."},{status:400});
    const known: Record<string,string>={ALREADY_OWNED:"Você já possui esta figurinha.",INSUFFICIENT_XP:"A doação exige 5 XP de quem envia e 20 XP de quem recebe."};
    if(error instanceof Error&&known[error.message])return NextResponse.json({message:known[error.message]},{status:409});
    const [message,status]=apiError(error);return NextResponse.json({message},{status});
  }
}
