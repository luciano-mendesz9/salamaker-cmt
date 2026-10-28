import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { consumeRateLimit } from "@/lib/request-security";
import { MAX_EXTERNAL_XP_GRANT, normalizeStudentAccessCode, XP_GRANT_CODE_PATTERN, xpGrantIdempotencyKey } from "@/lib/xp-grant-codes";

const input = z.object({
  usdente: z.string().trim().min(1).max(50).optional(),
  estudante: z.string().trim().min(1).max(50).optional(),
  xp: z.number().int().positive().max(MAX_EXTERNAL_XP_GRANT),
}).refine((body) => Boolean(body.usdente ?? body.estudante), { message: "STUDENT_CODE_REQUIRED" });

function clientFingerprint(request: Request) {
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return createHash("sha256").update(address).digest("hex").slice(0, 24);
}

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    if (!XP_GRANT_CODE_PATTERN.test(code)) return NextResponse.json({ message: "Código de XP inválido." }, { status: 404 });
    await consumeRateLimit(`xp-grant-code:redeem:${clientFingerprint(request)}`, 30, 10 * 60_000);
    const body = input.parse(await request.json());
    const accessCode = normalizeStudentAccessCode(body.usdente ?? body.estudante!);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const result = await prisma.$transaction(async (tx) => {
          const [grantCode, student] = await Promise.all([
            tx.xpGrantCode.findUnique({ where: { code }, select: { id: true, reason: true, createdById: true } }),
            tx.user.findFirst({ where: { accessCode, role: "STUDENT", status: "ACTIVE" }, select: { id: true, xp: true } }),
          ]);
          if (!grantCode) throw new Error("INVALID_XP_GRANT_CODE");
          if (!student) throw new Error("INVALID_STUDENT_CODE");
          if (student.xp > 2_147_483_647 - body.xp) throw new Error("XP_BALANCE_LIMIT");

          const prior = await tx.xpGrantRedemption.findUnique({
            where: { grantCodeId_studentId: { grantCodeId: grantCode.id, studentId: student.id } },
            select: { id: true },
          });
          if (prior) throw new Error("XP_GRANT_ALREADY_REDEEMED");

          const xpEntry = await tx.xpEntry.create({
            data: {
              studentId: student.id,
              authorId: grantCode.createdById,
              delta: body.xp,
              reason: grantCode.reason,
              source: "EXTERNAL_CODE",
              idempotencyKey: xpGrantIdempotencyKey(grantCode.id, student.id),
            },
            select: { id: true },
          });
          await tx.xpGrantRedemption.create({
            data: { grantCodeId: grantCode.id, studentId: student.id, xpEntryId: xpEntry.id, xpAmount: body.xp },
          });
          const updated = await tx.user.update({ where: { id: student.id }, data: { xp: { increment: body.xp } }, select: { xp: true } });
          await tx.auditLog.create({
            data: { actorId: grantCode.createdById, targetId: student.id, event: "XP_GRANT_CODE_REDEEMED", details: { grantCodeId: grantCode.id, xpEntryId: xpEntry.id, xp: body.xp } },
          });
          return { xp: updated.xp, addedXp: body.xp, reason: grantCode.reason };
        }, { isolationLevel: "Serializable", maxWait: 10_000, timeout: 20_000 });
        return NextResponse.json(result);
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code === "P2034" && attempt < 2) continue;
        if (code === "P2002") throw new Error("XP_GRANT_ALREADY_REDEEMED");
        throw error;
      }
    }
    throw new Error("XP_GRANT_RETRY_EXHAUSTED");
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return NextResponse.json({ message: `Envie { "usdente": "código do aluno", "xp": número inteiro entre 1 e ${MAX_EXTERNAL_XP_GRANT} }.` }, { status: 400 });
    const known: Record<string, [string, number]> = {
      INVALID_XP_GRANT_CODE: ["Código de XP inválido.", 404],
      INVALID_STUDENT_CODE: ["Código de aluno inválido ou aluno inativo.", 404],
      XP_GRANT_ALREADY_REDEEMED: ["Este aluno já recebeu XP com este código.", 409],
      XP_BALANCE_LIMIT: ["O saldo de XP do aluno atingiu o limite permitido.", 409],
      RATE_LIMITED: ["Muitas tentativas. Aguarde alguns minutos.", 429],
    };
    const message = error instanceof Error ? error.message : "UNKNOWN";
    const [responseMessage, status] = known[message] ?? ["Não foi possível adicionar XP agora.", 500];
    return NextResponse.json({ message: responseMessage }, { status });
  }
}
