import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireStudent } from "@/lib/authorization";
import { assertSameOrigin, consumeRateLimit } from "@/lib/request-security";
import { fileStudentComplaint, StudentComplaintError } from "@/lib/student-complaints";
import { studentComplaintsSchemaReady } from "@/lib/feature-readiness";

const input = z.object({ lessonId: z.string().uuid(), target: z.discriminatedUnion("kind", [z.object({ kind: z.literal("STUDENT"), studentId: z.string().uuid() }), z.object({ kind: z.literal("TEACHER") })]), reason: z.string().trim().min(10).max(2000), expectedFee: z.union([z.literal(0), z.literal(2), z.literal(5), z.literal(10)]), requestId: z.string().uuid() });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { student } = await requireStudent();
    if (!(await studentComplaintsSchemaReady())) return NextResponse.json({ message: "As reclamações aguardam a atualização do banco de dados." }, { status: 503 });
    await consumeRateLimit(`student-complaints:${student.id}`, 8, 10 * 60_000);
    const body = input.parse(await request.json());
    const result = await fileStudentComplaint(student.id, body.target, body.reason, body.requestId, body.lessonId, body.expectedFee);
    return NextResponse.json({ ...result, message: result.replayed ? "Reclamação já registrada." : result.fee ? `Reclamação enviada ao professor. Foram debitados ${result.fee} Dev-Coins.` : "Reclamação sobre o professor enviada sem custo." }, { status: result.replayed ? 200 : 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "Selecione o destinatário e escreva um motivo de 10 a 2.000 caracteres." }, { status: 400 });
    if (error instanceof StudentComplaintError) {
      const messages: Record<string, string> = {
        SELF_COMPLAINT: "Você não pode reclamar de si mesmo.",
        NO_OPEN_LESSON: "Não há aula aberta para esta reclamação.",
        LESSON_CHANGED: "A aula atual mudou. Atualize a página antes de enviar.",
        PRESENCE_REQUIRED: "Marque sua presença na aula atual antes de reclamar.",
        TARGET_UNAVAILABLE: "O aluno selecionado não está disponível.",
        LIMIT_REACHED: "Você já fez três reclamações sobre esse aluno nesta aula.",
        TEACHER_ALREADY_FILED: "Você já registrou uma reclamação sobre o professor nesta aula.",
        INSUFFICIENT_DEV_COINS: "Seu saldo de Dev-Coins é insuficiente para esta reclamação.",
        FEE_CHANGED: "O custo desta reclamação mudou. Atualize a página antes de enviar.",
        IDEMPOTENCY_CONFLICT: "Este envio já foi usado com outros dados. Abra o formulário novamente.",
      };
      return NextResponse.json({ message: messages[error.message] ?? "Não foi possível registrar a reclamação." }, { status: 409 });
    }
    if ((error as { code?: string }).code === "P2021" || (error as { code?: string }).code === "P2022") return NextResponse.json({ message: "As reclamações aguardam a atualização do banco de dados." }, { status: 503 });
    if ((error as { code?: string }).code === "P2028") return NextResponse.json({ message: "O banco demorou para responder. Confira seu histórico antes de tentar novamente." }, { status: 503 });
    const [message, status] = apiError(error);
    return NextResponse.json({ message }, { status });
  }
}
