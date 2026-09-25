import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, requireTeacher } from "@/lib/authorization";

const colors = ["#328fff", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#f43f5e"] as const;
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("THEME"), accentColor: z.enum(colors) }),
  z.object({ action: z.literal("STUDENT_AREA"), enabled: z.boolean(), teacherPassword: z.string().min(1) }),
  z.object({ action: z.literal("DEV_COIN_RATE"), devCoinsPerXp: z.number().int().min(1).max(10_000) }),
]);

export async function GET() {
  try {
    await requireTeacher();
    const settings = await prisma.appSetting.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
    return NextResponse.json({ settings });
  } catch (error) {
    const [message, status] = apiError(error);
    return NextResponse.json({ message }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const teacher = await requireTeacher();
    const body = schema.parse(await request.json());
    if (body.action === "STUDENT_AREA" && !(await compare(body.teacherPassword, teacher.passwordHash))) {
      return NextResponse.json({ message: "Senha do professor incorreta." }, { status: 403 });
    }
    const data = body.action === "THEME" ? { accentColor: body.accentColor } : body.action === "STUDENT_AREA" ? { studentAreaEnabled: body.enabled } : { devCoinsPerXp: body.devCoinsPerXp };
    const event = body.action === "THEME" ? "THEME_CHANGED" as const : body.action === "STUDENT_AREA" ? "MODERATION_CHANGED" as const : "DEV_COIN_RATE_CHANGED" as const;
    const details = body.action === "THEME" ? { accentColor: body.accentColor } : body.action === "STUDENT_AREA" ? { studentAreaEnabled: body.enabled } : { devCoinsPerXp: body.devCoinsPerXp };
    const settings = await prisma.$transaction(async (tx) => {
      const updated = await tx.appSetting.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
      await tx.auditLog.create({ data: { actorId: teacher.id, event, details } });
      return updated;
    });
    return NextResponse.json({ settings });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "Configuração inválida." }, { status: 400 });
    const [message, status] = apiError(error);
    return NextResponse.json({ message }, { status });
  }
}
