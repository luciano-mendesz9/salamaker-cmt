import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireStudent } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { assertSameOrigin, consumeRateLimit } from "@/lib/request-security";
import { requireCollectiblesSchema } from "@/lib/feature-readiness";

const input = z.object({ copyId: z.string().uuid(), recipientCode: z.string().trim().min(1).max(50), password: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const { student } = await requireStudent();
    await requireCollectiblesSchema();
    assertSameOrigin(request);
    await consumeRateLimit(`stickers:donate:${student.id}`, 15, 10 * 60_000);
    const body = input.parse(await request.json());
    if (!(await compare(body.password, student.passwordHash))) return NextResponse.json({ message: "Senha atual incorreta." }, { status: 403 });
    const donation = await prisma.$transaction(async tx => {
      const recipient = await tx.user.findFirst({ where: { accessCode: body.recipientCode, role: "STUDENT", status: "ACTIVE", id: { not: student.id } }, select: { id: true, firstName: true } });
      if (!recipient) throw new Error("INVALID_RECIPIENT");
      const copy = await tx.stickerCopy.findFirstOrThrow({ where: { id: body.copyId, ownerId: student.id, state: "OWNED" }, include: { sticker: true } });
      const freeCopies = await tx.stickerCopy.count({ where: { ownerId: student.id, stickerId: copy.stickerId, state: "OWNED" } });
      if (freeCopies < 2) throw new Error("NOT_DUPLICATE");
      if (await tx.stickerCopy.count({ where: { ownerId: recipient.id, stickerId: copy.stickerId } })) throw new Error("RECIPIENT_OWNS");
      const changed = await tx.stickerCopy.updateMany({ where: { id: copy.id, ownerId: student.id, state: "OWNED" }, data: { state: "ESCROW" } });
      if (changed.count !== 1) throw new Error("COPY_UNAVAILABLE");
      const created = await tx.stickerDonation.create({ data: { copyId: copy.id, senderId: student.id, recipientId: recipient.id, expiresAt: new Date(Date.now() + 7 * 86_400_000) } });
      const notification = await tx.notification.create({ data: { title: "Você recebeu uma doação de figurinha", body: `${student.firstName} quer doar ${copy.sticker.name}. Aceitar custa 20 XP para você e 5 XP para quem envia.`, kind: "INBOX", linkPath: "/aluno/album" } });
      await tx.notificationReceipt.create({ data: { notificationId: notification.id, studentId: recipient.id } });
      await tx.auditLog.create({ data: { actorId: student.id, targetId: recipient.id, event: "STICKER_DONATED", details: { donationId: created.id, state: "PENDING" } } });
      return created;
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ donation });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "Revise a cópia, o código do colega e a senha." }, { status: 400 });
    const known: Record<string,string> = { INVALID_RECIPIENT: "Colega ativo não encontrado.", NOT_DUPLICATE: "Somente uma duplicata livre pode ser doada.", RECIPIENT_OWNS: "Esse colega já possui a figurinha.", COPY_UNAVAILABLE: "Esta cópia não está mais disponível." };
    if (error instanceof Error && known[error.message]) return NextResponse.json({ message: known[error.message] }, { status: 409 });
    const [message,status]=apiError(error);return NextResponse.json({message},{status});
  }
}
