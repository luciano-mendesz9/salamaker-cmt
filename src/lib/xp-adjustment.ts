import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { adjustedXp, getDueXpAdjustmentPeriod } from "@/lib/xp-adjustment-policy";

const MAX_ATTEMPTS = 3;

export type XpAdjustmentResult = {
  status: "adjusted" | "already-adjusted" | "not-due";
  periodKey: string | null;
  students: number;
  changedStudents: number;
};

export async function applyMonthlyXpAdjustment(now = new Date()): Promise<XpAdjustmentResult> {
  const periodKey = getDueXpAdjustmentPeriod(now);
  if (!periodKey) return { status: "not-due", periodKey: null, students: 0, changedStudents: 0 };
  const keyPrefix = `monthly-xp-adjustment:${periodKey}:`;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const students = await tx.user.findMany({
          where: { role: "STUDENT" },
          select: { id: true, xp: true },
          orderBy: { id: "asc" },
        });
        const priorEntries = await tx.xpEntry.findMany({
          where: { idempotencyKey: { startsWith: keyPrefix } },
          select: { studentId: true },
        });
        const adjustedStudentIds = new Set(priorEntries.map((entry) => entry.studentId));
        const pendingStudents = students.filter((student) => !adjustedStudentIds.has(student.id));
        let changedStudents = 0;

        for (const student of pendingStudents) {
          const nextXp = adjustedXp(student.xp);
          const delta = nextXp - student.xp;
          if (delta !== 0) {
            await tx.user.update({ where: { id: student.id }, data: { xp: nextXp } });
            changedStudents += 1;
          }
          await tx.xpEntry.create({
            data: {
              studentId: student.id,
              delta,
              reason: `Ajuste geral de XP ${periodKey}: saldo dividido por 10 e arredondado para cima`,
              source: "SYSTEM",
              idempotencyKey: `${keyPrefix}${student.id}`,
            },
          });
        }

        return {
          status: pendingStudents.length ? "adjusted" as const : "already-adjusted" as const,
          periodKey,
          students: pendingStudents.length,
          changedStudents,
        };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 60_000 });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if ((code === "P2034" || code === "P2002") && attempt < MAX_ATTEMPTS - 1) continue;
      throw error;
    }
  }
  throw new Error("XP_ADJUSTMENT_RETRY_EXHAUSTED");
}
