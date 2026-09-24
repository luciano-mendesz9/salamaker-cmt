import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireStudent } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { profileAvatarPrice } from "@/lib/profile-avatar-pricing";
import { PROFILE_AVATAR_KEYS } from "@/lib/profile-avatars";

const input = z.object({
  avatar: z.enum(PROFILE_AVATAR_KEYS),
  expectedPrice: z.number().int().nonnegative(),
});

class AvatarPriceChanged extends Error {
  constructor(public readonly price: number, public readonly xp: number) {
    super("AVATAR_PRICE_CHANGED");
  }
}

async function applyAvatar(studentId: string, avatar: (typeof PROFILE_AVATAR_KEYS)[number], expectedPrice: number) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const student = await tx.user.findFirstOrThrow({
          where: { id: studentId, role: "STUDENT", status: "ACTIVE" },
          select: { id: true, xp: true },
        });
        const purchase = avatar === "default" ? null : await tx.profileAvatarPurchase.findUnique({
          where: { studentId_avatarKey: { studentId, avatarKey: avatar } },
          select: { pricePaid: true },
        });

        if (avatar === "default" || purchase) {
          await tx.user.update({ where: { id: studentId }, data: { profileAvatar: avatar } });
          return { avatar, xp: student.xp, pricePaid: purchase?.pricePaid ?? 0, purchasedNow: false };
        }

        const price = profileAvatarPrice(student.xp);
        if (price !== expectedPrice) throw new AvatarPriceChanged(price, student.xp);

        const xpEntry = await tx.xpEntry.create({
          data: {
            studentId,
            delta: -price,
            reason: `Compra da foto de perfil ${avatar}`,
            source: "PROFILE_AVATAR",
            idempotencyKey: `profile-avatar:${studentId}:${avatar}`,
          },
        });
        await tx.profileAvatarPurchase.create({
          data: { studentId, avatarKey: avatar, pricePaid: price, xpEntryId: xpEntry.id },
        });
        const updated = await tx.user.update({
          where: { id: studentId },
          data: { xp: { decrement: price }, profileAvatar: avatar },
          select: { xp: true },
        });
        return { avatar, xp: updated.xp, pricePaid: price, purchasedNow: true };
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if ((error as { code?: string }).code === "P2034" && attempt < 2) continue;
      throw error;
    }
  }
  throw new Error("TRANSACTION_RETRY_EXHAUSTED");
}

export async function PATCH(request: Request) {
  try {
    const { student } = await requireStudent();
    const { avatar, expectedPrice } = input.parse(await request.json());
    return NextResponse.json(await applyAvatar(student.id, avatar, expectedPrice));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Escolha uma foto de perfil disponível." }, { status: 400 });
    }
    if (error instanceof AvatarPriceChanged) {
      return NextResponse.json({ message: "Seu saldo de XP mudou. Confira o novo valor e confirme novamente.", price: error.price, xp: error.xp }, { status: 409 });
    }
    const [message, status] = apiError(error);
    return NextResponse.json({ message }, { status });
  }
}
