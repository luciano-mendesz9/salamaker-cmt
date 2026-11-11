import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireTeacher } from "@/lib/authorization";
import { assertSameOrigin } from "@/lib/request-security";
import { revokeStudentComplaint, StudentComplaintError } from "@/lib/student-complaints";

const input = z.object({ reason: z.string().trim().min(5).max(500) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const teacher = await requireTeacher();
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) return NextResponse.json({ message: "Reclamação inválida." }, { status: 400 });
    const body = input.parse(await request.json());
    return NextResponse.json(await revokeStudentComplaint(id, teacher.id, body.reason));
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "Informe uma justificativa de 5 a 500 caracteres." }, { status: 400 });
    if (error instanceof StudentComplaintError && error.message === "NOT_ACTIVE") return NextResponse.json({ message: "A reclamação já foi revogada ou não existe." }, { status: 409 });
    const [message, status] = apiError(error);
    return NextResponse.json({ message }, { status });
  }
}
