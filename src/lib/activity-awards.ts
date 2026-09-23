import type { Prisma } from "@/generated/prisma/client";
import { activityAwardDelta } from "@/lib/activities";

export async function applyActivityAward(
  tx: Prisma.TransactionClient,
  input: {
    activityId: string;
    recipientId: string;
    studentId: string;
    teacherId: string;
    awardedXp: number;
    maxXp: number;
    observation?: string | null;
    reason: string;
  },
) {
  if (!Number.isInteger(input.awardedXp) || input.awardedXp < 0 || input.awardedXp > input.maxXp) {
    throw new Error("INVALID_ACTIVITY_XP");
  }
  const current = await tx.activityAward.findUnique({ where: { recipientId: input.recipientId } });
  const previous = current?.awardedXp ?? 0;
  const delta = activityAwardDelta(previous, input.awardedXp);
  if (current && delta === 0 && current.observation === (input.observation ?? null)) return { award: current, delta: 0 };
  const revision = (current?.revision ?? 0) + 1;
  const xpEntry = await tx.xpEntry.create({
    data: {
      studentId: input.studentId,
      authorId: input.teacherId,
      delta,
      source: "ACTIVITY",
      reason: current ? `${input.reason} Revisão: ${delta >= 0 ? "+" : ""}${delta} XP.` : input.reason,
      idempotencyKey: `activity:${input.activityId}:${input.studentId}:revision:${revision}`,
    },
  });
  if (delta !== 0) await tx.user.update({ where: { id: input.studentId }, data: { xp: { increment: delta } } });
  const award = current
    ? await tx.activityAward.update({
        where: { id: current.id },
        data: { awardedXp: input.awardedXp, revision, observation: input.observation ?? null, latestXpEntryId: xpEntry.id, gradedAt: new Date() },
      })
    : await tx.activityAward.create({
        data: {
          activityId: input.activityId,
          recipientId: input.recipientId,
          studentId: input.studentId,
          awardedXp: input.awardedXp,
          revision,
          observation: input.observation ?? null,
          latestXpEntryId: xpEntry.id,
        },
      });
  await tx.activityRecipient.update({ where: { id: input.recipientId }, data: { completedAt: new Date() } });
  return { award, delta };
}
