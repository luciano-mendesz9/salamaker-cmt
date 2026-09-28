import {randomUUID} from "node:crypto";import {NextResponse} from "next/server";import {z} from "zod";import {prisma} from "@/lib/db";import {apiError,requireTeacher,verifyAdminActionPassword} from "@/lib/authorization";
import { requireCollectiblesSchema } from "@/lib/feature-readiness";
const monetaryAction = {
  ids: z.array(z.string().uuid()).min(1).max(100),
  amount: z.number().int().min(1).max(10_000),
  reason: z.string().trim().min(3).max(160),
  adminPassword: z.string(),
};
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("XP"), ...monetaryAction }),
  z.object({ action: z.literal("DEV_COINS"), ...monetaryAction }),
  z.object({ action: z.literal("ARCHIVE"), ids: monetaryAction.ids, adminPassword: z.string() }),
]);

export async function POST(request: Request) {
  try {
    const teacher = await requireTeacher();
    const body = schema.parse(await request.json());
    verifyAdminActionPassword(body.adminPassword);
    const students = await prisma.user.findMany({
      where: { id: { in: body.ids }, role: "STUDENT", status: "ACTIVE" },
      select: { id: true },
    });
    if (!students.length) return NextResponse.json({ message: "Nenhum aluno ativo selecionado." }, { status: 400 });

    const operationId = randomUUID();
    if (body.action === "XP") {
      await prisma.$transaction(students.flatMap((student) => [
        prisma.user.update({ where: { id: student.id }, data: { xp: { increment: body.amount } } }),
        prisma.xpEntry.create({ data: { studentId: student.id, authorId: teacher.id, delta: body.amount, reason: body.reason, source: "BULK", idempotencyKey: `bulk:${operationId}:${student.id}` } }),
      ]));
    } else if (body.action === "DEV_COINS") {
      await requireCollectiblesSchema();
      const total = body.amount * students.length;
      await prisma.$transaction(async (tx) => {
        const treasury = await tx.devCoinTreasury.updateMany({ where: { id: 1, balance: { gte: total } }, data: { balance: { decrement: total } } });
        if (treasury.count !== 1) throw new Error("INSUFFICIENT_TREASURY");
        await tx.devCoinTreasuryEntry.create({ data: { authorId: teacher.id, delta: -total, reason: body.reason, source: "TEACHER_DISTRIBUTION", idempotencyKey: `treasury:teacher-grant:${operationId}` } });
        for (const student of students) {
          await tx.user.update({ where: { id: student.id }, data: { devCoins: { increment: body.amount } } });
          await tx.devCoinEntry.create({ data: { studentId: student.id, authorId: teacher.id, delta: body.amount, reason: body.reason, source: "TEACHER_GRANT", idempotencyKey: `teacher-grant:${operationId}:${student.id}` } });
          await tx.auditLog.create({ data: { actorId: teacher.id, targetId: student.id, event: "DEV_COIN_GRANTED", details: { amount: body.amount, reason: body.reason, operationId, treasuryTransfer: true } } });
        }
      }, { isolationLevel: "Serializable" });
    } else {
      await prisma.$transaction([
        ...students.map((student) => prisma.user.update({ where: { id: student.id }, data: { status: "INACTIVE", deactivatedAt: new Date(), sessionVersion: { increment: 1 } } })),
        ...students.map((student) => prisma.auditLog.create({ data: { actorId: teacher.id, targetId: student.id, event: "USER_STATUS_CHANGED", details: { status: "INACTIVE", bulk: true } } })),
      ]);
    }
    return NextResponse.json({ updated: students.length });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "Revise os dados da ação em massa." }, { status: 400 });
    if (error instanceof Error && error.message === "INSUFFICIENT_TREASURY") return NextResponse.json({ message: "O caixa não possui Dev-Coins suficientes para esta distribuição." }, { status: 409 });
    const [message, status] = apiError(error);
    return NextResponse.json({ message }, { status });
  }
}
