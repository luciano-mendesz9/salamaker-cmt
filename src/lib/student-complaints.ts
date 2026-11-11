import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { nextComplaintCost } from "@/lib/student-complaint-policy";
import { creditTreasury } from "@/lib/treasury";

export class StudentComplaintError extends Error {}
export type ComplaintTarget = { kind: "STUDENT"; studentId: string } | { kind: "TEACHER" };

export async function fileStudentComplaint(reporterId: string, target: ComplaintTarget, reason: string, requestId: string, expectedLessonId: string, expectedFee: number) {
  if (target.kind === "STUDENT" && reporterId === target.studentId) throw new StudentComplaintError("SELF_COMPLAINT");
  const requestKey = `student-complaint:${reporterId}:${requestId}`;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${reporterId}::uuid FOR UPDATE`;
        const existing = await tx.studentComplaint.findUnique({ where: { requestKey } });
        if (existing) {
          if (existing.lessonId !== expectedLessonId || existing.targetKind !== target.kind || (target.kind === "STUDENT" && existing.targetId !== target.studentId) || existing.reason !== reason) throw new StudentComplaintError("IDEMPOTENCY_CONFLICT");
          const fee = nextComplaintCost(target.kind, existing.ordinal - 1)?.fee ?? 0;
          if (fee !== expectedFee) throw new StudentComplaintError("IDEMPOTENCY_CONFLICT");
          return { id: existing.id, fee, ordinal: existing.ordinal, replayed: true };
        }

        const lesson = await tx.lesson.findFirst({ where: { status: "OPEN" }, select: { id: true, title: true, teacherId: true } });
        if (!lesson) throw new StudentComplaintError("NO_OPEN_LESSON");
        if (lesson.id !== expectedLessonId) throw new StudentComplaintError("LESSON_CHANGED");
        await tx.$queryRaw`SELECT "id" FROM "Lesson" WHERE "id" = ${lesson.id}::uuid FOR UPDATE`;
        const currentLesson = await tx.lesson.findUniqueOrThrow({ where: { id: lesson.id }, select: { status: true } });
        if (currentLesson.status !== "OPEN") throw new StudentComplaintError("NO_OPEN_LESSON");
        const targetId = target.kind === "TEACHER" ? lesson.teacherId : target.studentId;

        const [reporter, attendance, targetStudent, previousCount] = await Promise.all([
          tx.user.findFirst({ where: { id: reporterId, role: "STUDENT", status: "ACTIVE" }, select: { devCoins: true } }),
          tx.attendance.findUnique({ where: { lessonId_studentId: { lessonId: lesson.id, studentId: reporterId } }, select: { status: true } }),
          target.kind === "STUDENT" ? tx.user.findFirst({ where: { id: targetId, role: "STUDENT", status: "ACTIVE" }, select: { id: true } }) : Promise.resolve(null),
          tx.studentComplaint.count({ where: { lessonId: lesson.id, reporterId, targetId, targetKind: target.kind } }),
        ]);
        if (!reporter || !attendance || attendance.status !== "PRESENT") throw new StudentComplaintError("PRESENCE_REQUIRED");
        if (target.kind === "STUDENT" && !targetStudent) throw new StudentComplaintError("TARGET_UNAVAILABLE");
        const charge = nextComplaintCost(target.kind, previousCount);
        if (!charge) throw new StudentComplaintError(target.kind === "TEACHER" ? "TEACHER_ALREADY_FILED" : "LIMIT_REACHED");
        if (charge.fee !== expectedFee) throw new StudentComplaintError("FEE_CHANGED");
        if (reporter.devCoins < charge.fee) throw new StudentComplaintError("INSUFFICIENT_DEV_COINS");

        if (charge.fee > 0) {
          const debit = await tx.user.updateMany({ where: { id: reporterId, role: "STUDENT", status: "ACTIVE", devCoins: { gte: charge.fee } }, data: { devCoins: { decrement: charge.fee } } });
          if (debit.count !== 1) throw new StudentComplaintError("INSUFFICIENT_DEV_COINS");
        }
        const complaintId = randomUUID();
        const feeEntry = charge.fee > 0 ? await tx.devCoinEntry.create({ data: { studentId: reporterId, authorId: reporterId, delta: -charge.fee, reason: `Registro de reclamação na aula “${lesson.title}”`, source: "STUDENT_COMPLAINT_FEE", idempotencyKey: `${requestKey}:fee` } }) : null;
        if (feeEntry) await creditTreasury(tx, charge.fee, { reason: `Taxa de reclamação ${complaintId}`, source: "STUDENT_COMPLAINT_FEE", idempotencyKey: `${requestKey}:treasury`, devCoinEntryId: feeEntry.id });
        const complaint = await tx.studentComplaint.create({ data: { id: complaintId, lessonId: lesson.id, reporterId, targetId, targetKind: target.kind, ordinal: charge.ordinal, reason, requestKey, feeEntryId: feeEntry?.id ?? null } });
        await tx.auditLog.create({ data: { actorId: reporterId, targetId, event: "STUDENT_COMPLAINT_CREATED", details: { complaintId: complaint.id, lessonId: lesson.id, targetKind: target.kind, ordinal: charge.ordinal, fee: charge.fee } } });
        return { id: complaint.id, fee: charge.fee, ordinal: charge.ordinal, replayed: false };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 20_000 });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if ((code === "P2034" || code === "P2002") && attempt < 2) continue;
      if (code === "P2002") throw new StudentComplaintError("LIMIT_REACHED");
      throw error;
    }
  }
  throw new StudentComplaintError("RETRY_EXHAUSTED");
}

export async function revokeStudentComplaint(complaintId: string, teacherId: string, revocationReason: string) {
  return prisma.$transaction(async (tx) => {
    const changed = await tx.studentComplaint.updateMany({ where: { id: complaintId, status: "ACTIVE" }, data: { status: "REVOKED", revokedAt: new Date(), revokedById: teacherId, revocationReason } });
    if (changed.count !== 1) throw new StudentComplaintError("NOT_ACTIVE");
    const complaint = await tx.studentComplaint.findUniqueOrThrow({ where: { id: complaintId }, select: { targetId: true, lessonId: true } });
    await tx.auditLog.create({ data: { actorId: teacherId, targetId: complaint.targetId, event: "STUDENT_COMPLAINT_REVOKED", details: { complaintId, lessonId: complaint.lessonId, revocationReason } } });
    return { id: complaintId };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 20_000 });
}
