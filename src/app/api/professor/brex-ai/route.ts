import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireTeacher } from "@/lib/authorization";
import { validBrexOrigin } from "@/lib/brex-ai";
import { prisma } from "@/lib/db";
import { requestHasSameOrigin } from "@/lib/request-origin";

const schema = z.object({ enabled: z.boolean(), version: z.string().trim().min(1).max(40), origin: z.string().trim().max(250).nullable() });

export async function PATCH(request: Request) {
  try {
    if (!requestHasSameOrigin(request)) return NextResponse.json({ message: "Origem inválida." }, { status: 403 });
    const teacher = await requireTeacher();
    const body = schema.parse(await request.json());
    const origin = body.origin?.replace(/\/$/, "") || null;
    if (origin && !validBrexOrigin(origin)) return NextResponse.json({ message: "Informe somente um domínio HTTPS do ngrok, sem rota." }, { status: 400 });
    if (body.enabled && !origin) return NextResponse.json({ message: "Configure o domínio antes de ativar o Brex." }, { status: 400 });
    const settings = await prisma.$transaction(async (tx) => {
      const updated = await tx.brexSetting.upsert({ where: { id: 1 }, create: { id: 1, enabled: body.enabled, version: body.version, origin }, update: { enabled: body.enabled, version: body.version, origin } });
      await tx.auditLog.create({ data: { actorId: teacher.id, event: "MODERATION_CHANGED", details: { brexAI: { enabled: body.enabled, version: body.version, origin } } } });
      return updated;
    });
    return NextResponse.json({ settings });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "Revise os campos da configuração." }, { status: 400 });
    const [message, status] = apiError(error);
    return NextResponse.json({ message }, { status });
  }
}
