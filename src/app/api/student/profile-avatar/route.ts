import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireStudent } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { PROFILE_AVATAR_DEV_COIN_PRICE } from "@/lib/profile-avatar-pricing";
import { PROFILE_AVATAR_KEYS } from "@/lib/profile-avatars";

const input = z.object({
  avatar: z.enum(PROFILE_AVATAR_KEYS),
});

class InsufficientDevCoins extends Error {
  constructor(public readonly devCoins: number) {
    super("INSUFFICIENT_DEV_COINS");
  }
}

async function applyAvatar(studentId: string, avatar: (typeof PROFILE_AVATAR_KEYS)[number]) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const student = await tx.user.findFirstOrThrow({
          where: { id: studentId, role: "STUDENT", status: "ACTIVE" },
          select: { id: true, devCoins: true },
        });
        const purchase = avatar === "default" ? null : await tx.profileAvatarPurchase.findUnique({
          where: { studentId_avatarKey: { studentId, avatarKey: avatar } },
          select: { amountPaid: true, currency: true },
        });

        if (avatar === "default" || purchase) {
          await tx.user.update({ where: { id: studentId }, data: { profileAvatar: avatar } });
          return { avatar, devCoins: student.devCoins, pricePaid: purchase?.amountPaid ?? 0, purchasedNow: false };
        }

        const debit = await tx.user.updateMany({
          where: { id: studentId, role: "STUDENT", status: "ACTIVE", devCoins: { gte: PROFILE_AVATAR_DEV_COIN_PRICE } },
          data: { devCoins: { decrement: PROFILE_AVATAR_DEV_COIN_PRICE }, profileAvatar: avatar },
        });
        if (debit.count !== 1) throw new InsufficientDevCoins(student.devCoins);
        const devCoinEntry = await tx.devCoinEntry.create({
          data: {
            studentId,
            delta: -PROFILE_AVATAR_DEV_COIN_PRICE,
            reason: `Compra da foto de perfil ${avatar}`,
            source: "PROFILE_AVATAR",
            idempotencyKey: `profile-avatar:${studentId}:${avatar}`,
          },
        });
        await tx.profileAvatarPurchase.create({
          data: {
            studentId,
            avatarKey: avatar,
            amountPaid: PROFILE_AVATAR_DEV_COIN_PRICE,
            currency: "DEV_COIN",
            devCoinEntryId: devCoinEntry.id,
          },
        });
        return { avatar, devCoins: student.devCoins - PROFILE_AVATAR_DEV_COIN_PRICE, pricePaid: PROFILE_AVATAR_DEV_COIN_PRICE, purchasedNow: true };
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
    const { avatar } = input.parse(await request.json());
    return NextResponse.json(await applyAvatar(student.id, avatar));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Escolha uma foto de perfil disponível." }, { status: 400 });
    }
    if (error instanceof InsufficientDevCoins) {
      return NextResponse.json({ message: "Você precisa de 20 Dev-Coins para comprar esta foto.", devCoins: error.devCoins }, { status: 409 });
    }
    const [message, status] = apiError(error);
    return NextResponse.json({ message }, { status });
  }
}
