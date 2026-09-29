import { compare, hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireTeacher } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { assertSameOrigin, consumeRateLimit } from "@/lib/request-security";
import { SESSION_COOKIE } from "@/lib/session";
import { validatePermanentPassword } from "@/lib/student-password";

const input = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: z.string().min(1).max(72),
  confirmation: z.string().min(1).max(72),
});

export async function POST(request: Request) {
  try {
    const teacher = await requireTeacher();
    assertSameOrigin(request);
    await consumeRateLimit(`teacher:change-password:${teacher.id}`, 8, 15 * 60_000);

    const body = input.parse(await request.json());
    if (body.newPassword !== body.confirmation) {
      return NextResponse.json({ message: "A confirmação não corresponde à nova senha." }, { status: 400 });
    }
    validatePermanentPassword(body.newPassword);
    if (!(await compare(body.currentPassword, teacher.passwordHash))) {
      return NextResponse.json({ message: "A senha atual está incorreta." }, { status: 403 });
    }
    if (await compare(body.newPassword, teacher.passwordHash)) {
      return NextResponse.json({ message: "A nova senha precisa ser diferente da senha atual." }, { status: 400 });
    }

    const passwordHash = await hash(body.newPassword, 12);
    await prisma.$transaction(async tx => {
      await tx.user.update({
        where: { id: teacher.id, role: "TEACHER", status: "ACTIVE" },
        data: { passwordHash, sessionVersion: { increment: 1 } },
      });
      await tx.auditLog.create({
        data: { actorId: teacher.id, targetId: teacher.id, event: "PASSWORD_CHANGED", details: { selfService: true } },
      });
    });

    const response = NextResponse.json({ redirectTo: "/login" });
    response.cookies.delete(SESSION_COOKIE);
    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Preencha a senha atual, a nova senha e a confirmação." }, { status: 400 });
    }
    if (error instanceof Error && (error.message.startsWith("A nova senha") || error.message.startsWith("Escolha uma senha"))) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    const [message, status] = apiError(error);
    return NextResponse.json({ message }, { status });
  }
}
