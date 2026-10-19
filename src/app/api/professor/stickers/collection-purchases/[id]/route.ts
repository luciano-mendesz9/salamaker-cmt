import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireTeacher } from "@/lib/authorization";
import { requireCollectionPurchasesSchema } from "@/lib/feature-readiness";
import { assertSameOrigin, consumeRateLimit } from "@/lib/request-security";
import { cancelTeacherCollectionRequest, TeacherCollectionPurchaseError, updateTeacherCollectionRequest } from "@/lib/teacher-collection-purchases";

const input = z.object({ xpAmount: z.number().int().min(1).max(10_000) });
const requestIdSchema = z.string().uuid();
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  try {
    const teacher = await requireTeacher();
    await requireCollectionPurchasesSchema();
    assertSameOrigin(request);
    await consumeRateLimit(`collection-purchase:update:${teacher.id}`, 30, 10 * 60_000);
    const id = requestIdSchema.parse((await params).id);
    const body = input.parse(await request.json());
    const purchaseRequest = await updateTeacherCollectionRequest(teacher.id, id, body.xpAmount);
    return NextResponse.json({ request: purchaseRequest });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "Informe de 1 a 10.000 XP." }, { status: 400 });
    if (error instanceof TeacherCollectionPurchaseError) return NextResponse.json({ message: error.message === "REQUEST_NOT_OPEN" ? "Esta compra não está mais aberta." : "Compra não encontrada." }, { status: 409 });
    const [message, status] = apiError(error);
    return NextResponse.json({ message }, { status });
  }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    const teacher = await requireTeacher();
    await requireCollectionPurchasesSchema();
    assertSameOrigin(request);
    await consumeRateLimit(`collection-purchase:cancel:${teacher.id}`, 15, 10 * 60_000);
    const id = requestIdSchema.parse((await params).id);
    return NextResponse.json(await cancelTeacherCollectionRequest(teacher.id, id));
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "Compra inválida." }, { status: 400 });
    if (error instanceof TeacherCollectionPurchaseError) return NextResponse.json({ message: error.message === "REQUEST_NOT_OPEN" ? "Esta compra não está mais aberta." : "Compra não encontrada." }, { status: 409 });
    const [message, status] = apiError(error);
    return NextResponse.json({ message }, { status });
  }
}
