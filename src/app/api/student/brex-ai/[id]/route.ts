import { NextResponse } from "next/server";
import { apiError, requireStudent } from "@/lib/authorization";
import { decryptBrexMessage } from "@/lib/brex-ai";
import { prisma } from "@/lib/db";
import { requestHasSameOrigin } from "@/lib/request-origin";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  try {
    const { student } = await requireStudent();
    const { id } = await params;
    const chat = await prisma.brexChat.findFirst({ where: { id, studentId: student.id }, include: { messages: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } } });
    if (!chat) return NextResponse.json({ message: "Conversa não encontrada." }, { status: 404 });
    return NextResponse.json({ id: chat.id, title: chat.title, messages: chat.messages.map((item) => ({ id: item.id, role: item.role, content: decryptBrexMessage(item.encrypted), createdAt: item.createdAt, inputTokens: item.inputTokens, outputTokens: item.outputTokens })) });
  } catch (error) {
    const [message, status] = apiError(error);
    return NextResponse.json({ message }, { status });
  }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    if (!requestHasSameOrigin(request)) return NextResponse.json({ message: "Origem inválida." }, { status: 403 });
    const { student } = await requireStudent();
    const { id } = await params;
    const removed = await prisma.brexChat.deleteMany({ where: { id, studentId: student.id } });
    return NextResponse.json({ removed: removed.count > 0 });
  } catch (error) {
    const [message, status] = apiError(error);
    return NextResponse.json({ message }, { status });
  }
}
