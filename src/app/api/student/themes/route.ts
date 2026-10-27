import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireStudent } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { requireStudentThemesSchema } from "@/lib/feature-readiness";
import { assertSameOrigin, consumeRateLimit } from "@/lib/request-security";
import { DEFAULT_STUDENT_THEME, getStudentTheme, STUDENT_THEME_KEYS, STUDENT_THEME_PRICE } from "@/lib/student-themes";
import { creditTreasury } from "@/lib/treasury";

const input = z.object({ theme: z.enum(STUDENT_THEME_KEYS) });

class InsufficientDevCoins extends Error {
  constructor(public readonly devCoins: number) {
    super("INSUFFICIENT_DEV_COINS");
  }
}

async function selectTheme(studentId: string, theme: (typeof STUDENT_THEME_KEYS)[number]) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${studentId}::uuid FOR UPDATE`;
        const student = await tx.user.findFirstOrThrow({
          where: { id: studentId, role: "STUDENT", status: "ACTIVE" },
          select: { devCoins: true },
        });

        await tx.studentThemePurchase.updateMany({ where: { studentId, selectedAt: { not: null } }, data: { selectedAt: null } });
        if (theme === DEFAULT_STUDENT_THEME) {
          return { activeTheme: theme, devCoins: student.devCoins, purchasedNow: false };
        }

        const owned = await tx.studentThemePurchase.findUnique({
          where: { studentId_themeKey: { studentId, themeKey: theme } },
          select: { id: true },
        });
        if (owned) {
          await tx.studentThemePurchase.update({ where: { id: owned.id }, data: { selectedAt: new Date() } });
          return { activeTheme: theme, devCoins: student.devCoins, purchasedNow: false };
        }

        const debit = await tx.user.updateMany({
          where: { id: studentId, role: "STUDENT", status: "ACTIVE", devCoins: { gte: STUDENT_THEME_PRICE } },
          data: { devCoins: { decrement: STUDENT_THEME_PRICE } },
        });
        if (debit.count !== 1) throw new InsufficientDevCoins(student.devCoins);

        const reason = `Compra do tema ${getStudentTheme(theme).name}`;
        const devCoinEntry = await tx.devCoinEntry.create({
          data: {
            studentId,
            delta: -STUDENT_THEME_PRICE,
            reason,
            source: "STUDENT_THEME",
            idempotencyKey: `student-theme:${studentId}:${theme}`,
          },
        });
        await creditTreasury(tx, STUDENT_THEME_PRICE, {
          reason,
          source: "PLATFORM_PURCHASE",
          idempotencyKey: `treasury:student-theme:${studentId}:${theme}`,
          devCoinEntryId: devCoinEntry.id,
        });
        await tx.studentThemePurchase.create({
          data: { studentId, themeKey: theme, amountPaid: STUDENT_THEME_PRICE, devCoinEntryId: devCoinEntry.id, selectedAt: new Date() },
        });
        return { activeTheme: theme, devCoins: student.devCoins - STUDENT_THEME_PRICE, purchasedNow: true };
      }, { isolationLevel: "Serializable", maxWait: 10_000, timeout: 20_000 });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if ((code === "P2034" || code === "P2002") && attempt < 2) continue;
      throw error;
    }
  }
  throw new Error("TRANSACTION_RETRY_EXHAUSTED");
}

export async function PATCH(request: Request) {
  try {
    const { student } = await requireStudent();
    assertSameOrigin(request);
    await consumeRateLimit(`student-theme:${student.id}`, 20, 10 * 60_000);
    await requireStudentThemesSchema();
    const { theme } = input.parse(await request.json());
    return NextResponse.json(await selectTheme(student.id, theme));
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "Escolha um tema disponível." }, { status: 400 });
    if (error instanceof InsufficientDevCoins) {
      return NextResponse.json({ message: `Você precisa de ${STUDENT_THEME_PRICE} Dev-Coins para comprar este tema.`, devCoins: error.devCoins }, { status: 409 });
    }
    const [message, status] = apiError(error);
    return NextResponse.json({ message }, { status });
  }
}
