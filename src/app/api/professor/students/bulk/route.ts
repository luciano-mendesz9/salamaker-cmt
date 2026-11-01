import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, requireTeacher, verifyAdminActionPassword } from "@/lib/authorization";
import { requireCollectiblesSchema } from "@/lib/feature-readiness";
import { assertSameOrigin } from "@/lib/request-security";
import { studentBulkActionSchema } from "@/lib/student-bulk-actions";

export async function POST(request: Request) {
  try {
    const teacher = await requireTeacher();
    assertSameOrigin(request);
    const body = studentBulkActionSchema.parse(await request.json());
    verifyAdminActionPassword(body.adminPassword);

    if (body.action === "DEV_COINS") {
      await requireCollectiblesSchema();
      const ids = [...body.ids].sort();
      const prefix = `treasury:teacher-adjust:${teacher.id}:${body.requestId}:`;
      const total = Math.abs(body.amount) * ids.length;
      let result: { updated: number; balances: { id: string; devCoins: number }[] } | undefined;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          result = await prisma.$transaction(async (tx) => {
            const previous = await tx.devCoinTreasuryEntry.findMany({
              where: { idempotencyKey: { startsWith: prefix } },
              include: { devCoinEntry: { select: { studentId: true, delta: true } } },
            });
            if (previous.length) {
              const previousIds = previous.map((entry) => entry.devCoinEntry?.studentId).sort();
              if (previous.length !== ids.length || previousIds.some((id, index) => id !== ids[index]) ||
                  previous.some((entry) => entry.authorId !== teacher.id || entry.reason !== body.reason ||
                    entry.delta !== -body.amount || entry.devCoinEntry?.delta !== body.amount)) {
                throw new Error("REQUEST_ID_REUSED");
              }
              const balances = await tx.user.findMany({ where: { id: { in: ids } }, select: { id: true, devCoins: true } });
              return { updated: ids.length, balances };
            }

            const students = await tx.user.findMany({
              where: { id: { in: ids }, role: "STUDENT", status: "ACTIVE" },
              select: { id: true },
            });
            if (students.length !== ids.length) throw new Error("INVALID_STUDENT_SELECTION");
            const treasury = await tx.devCoinTreasury.updateMany({
              where: body.amount > 0 ? { id: 1, balance: { gte: total } } : { id: 1 },
              data: { balance: { increment: -body.amount * ids.length } },
            });
            if (treasury.count !== 1) throw new Error("INSUFFICIENT_TREASURY");

            for (const studentId of ids) {
              const changed = await tx.user.updateMany({
                where: {
                  id: studentId,
                  role: "STUDENT",
                  status: "ACTIVE",
                  ...(body.amount < 0 ? { devCoins: { gte: -body.amount } } : {}),
                },
                data: { devCoins: { increment: body.amount } },
              });
              if (changed.count !== 1) throw new Error(body.amount < 0 ? "INSUFFICIENT_STUDENT_DEV_COINS" : "INVALID_STUDENT_SELECTION");
              const devCoinEntry = await tx.devCoinEntry.create({
                data: {
                  studentId, authorId: teacher.id, delta: body.amount, reason: body.reason,
                  source: "TEACHER_GRANT",
                  idempotencyKey: `teacher-adjust:${teacher.id}:${body.requestId}:${studentId}`,
                },
              });
              await tx.devCoinTreasuryEntry.create({
                data: {
                  authorId: teacher.id, devCoinEntryId: devCoinEntry.id, delta: -body.amount,
                  reason: body.reason, source: "TEACHER_DISTRIBUTION",
                  idempotencyKey: `${prefix}${studentId}`,
                },
              });
              await tx.auditLog.create({
                data: {
                  actorId: teacher.id, targetId: studentId,
                  event: body.amount < 0 ? "DEV_COIN_TREASURY_CHANGED" : "DEV_COIN_GRANTED",
                  details: {
                    action: body.amount < 0 ? "STUDENT_DEBIT_TO_TREASURY" : "TREASURY_GRANT_TO_STUDENT",
                    amount: body.amount, reason: body.reason, requestId: body.requestId,
                    devCoinEntryId: devCoinEntry.id,
                  },
                },
              });
            }
            const balances = await tx.user.findMany({ where: { id: { in: ids } }, select: { id: true, devCoins: true } });
            return { updated: ids.length, balances };
          }, { isolationLevel: "Serializable", maxWait: 10_000, timeout: 30_000 });
          break;
        } catch (error) {
          if (["P2034", "P2002"].includes((error as { code?: string }).code ?? "") && attempt < 2) continue;
          throw error;
        }
      }
      if (!result) throw new Error("TRANSACTION_RETRY_EXHAUSTED");
      return NextResponse.json(result);
    }

    const students = await prisma.user.findMany({
      where: { id: { in: body.ids }, role: "STUDENT", status: "ACTIVE" },
      select: { id: true },
    });
    if (!students.length) return NextResponse.json({ message: "Nenhum aluno ativo selecionado." }, { status: 400 });
    if (body.action === "XP") {
      const operationId = randomUUID();
      await prisma.$transaction(students.flatMap((student) => [
        prisma.user.update({ where: { id: student.id }, data: { xp: { increment: body.amount } } }),
        prisma.xpEntry.create({ data: { studentId: student.id, authorId: teacher.id, delta: body.amount, reason: body.reason, source: "BULK", idempotencyKey: `bulk:${operationId}:${student.id}` } }),
      ]));
    } else {
      await prisma.$transaction([
        ...students.map((student) => prisma.user.update({ where: { id: student.id }, data: { status: "INACTIVE", deactivatedAt: new Date(), sessionVersion: { increment: 1 } } })),
        ...students.map((student) => prisma.auditLog.create({ data: { actorId: teacher.id, targetId: student.id, event: "USER_STATUS_CHANGED", details: { status: "INACTIVE", bulk: true } } })),
      ]);
    }
    return NextResponse.json({ updated: students.length });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "Revise os dados da ação em massa." }, { status: 400 });
    if (error instanceof Error && error.message === "INSUFFICIENT_TREASURY") return NextResponse.json({ message: "O caixa não possui DevCoins suficientes para esta distribuição." }, { status: 409 });
    if (error instanceof Error && error.message === "INSUFFICIENT_STUDENT_DEV_COINS") return NextResponse.json({ message: "Um dos alunos não possui DevCoins suficientes. Nenhum saldo foi alterado." }, { status: 409 });
    if (error instanceof Error && error.message === "INVALID_STUDENT_SELECTION") return NextResponse.json({ message: "A seleção contém aluno inexistente ou inativo. Nenhum saldo foi alterado." }, { status: 409 });
    if (error instanceof Error && error.message === "REQUEST_ID_REUSED") return NextResponse.json({ message: "Esta solicitação já foi usada com outros dados. Reabra o formulário e tente novamente." }, { status: 409 });
    const [message, status] = apiError(error);
    return NextResponse.json({ message }, { status });
  }
}
