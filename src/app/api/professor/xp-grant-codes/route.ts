import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireTeacher } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { assertSameOrigin, consumeRateLimit } from "@/lib/request-security";
import { XP_GRANT_CODE_PATTERN } from "@/lib/xp-grant-codes";

const input = z.object({
  code: z.string().regex(XP_GRANT_CODE_PATTERN),
  reason: z.string().trim().min(3).max(300),
  teacherPassword: z.string().min(1).max(72),
});

export async function POST(request: Request) {
  try {
    const teacher = await requireTeacher();
    assertSameOrigin(request);
    await consumeRateLimit(`xp-grant-code:create:${teacher.id}`, 20, 10 * 60_000);
    const body = input.parse(await request.json());
    if (!(await compare(body.teacherPassword, teacher.passwordHash))) {
      return NextResponse.json({ message: "Senha do professor incorreta." }, { status: 403 });
    }

    const grantCode = await prisma.$transaction(async (tx) => {
      const created = await tx.xpGrantCode.create({
        data: { code: body.code, reason: body.reason, createdById: teacher.id },
        select: { id: true, code: true, reason: true, createdAt: true },
      });
      await tx.auditLog.create({
        data: { actorId: teacher.id, event: "XP_GRANT_CODE_CREATED", details: { grantCodeId: created.id, reason: created.reason } },
      });
      return created;
    });

    return NextResponse.json({ grantCode }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return NextResponse.json({ message: "Informe um código de 6 dígitos, o motivo e sua senha." }, { status: 400 });
    if ((error as { code?: string }).code === "P2002") return NextResponse.json({ message: "Este código já existe. Gere ou informe outro código." }, { status: 409 });
    const [message, status] = apiError(error);
    return NextResponse.json({ message }, { status });
  }
}
