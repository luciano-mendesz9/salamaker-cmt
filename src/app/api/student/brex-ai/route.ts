import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireStudent } from "@/lib/authorization";
import { brexFetch, brexSettings, brexTitle, brexTokenBalance, decryptBrexMessage, encryptBrexMessage, reserveBrexRun, BREX_MESSAGE_TOKEN_LIMIT } from "@/lib/brex-ai";
import { currentBrexQuota, debitBrexQuota } from "@/lib/brex-token-quota";
import { prisma } from "@/lib/db";
import { requestHasSameOrigin } from "@/lib/request-origin";

export const maxDuration = 180;
const input = z.object({ query: z.string().trim().min(1).max(300), chatId: z.string().uuid().nullable().optional() });

export async function GET() {
  try {
    const { student } = await requireStudent();
    const chats = await prisma.brexChat.findMany({ where: { studentId: student.id }, select: { id: true, title: true, updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 50 });
    return NextResponse.json({ chats });
  } catch (error) {
    const [message, status] = apiError(error);
    return NextResponse.json({ message }, { status });
  }
}

export async function POST(request: Request) {
  let runId: string | undefined;
  let studentId: string | undefined;
  try {
    if (!requestHasSameOrigin(request)) return NextResponse.json({ message: "Origem inválida." }, { status: 403 });
    const { student } = await requireStudent();
    studentId = student.id;
    const { query, chatId = null } = input.parse(await request.json());
    const settings = await brexSettings();
    if (!settings?.enabled || !settings.origin) return NextResponse.json({ message: "Brex está desativado." }, { status: 503 });
    const chat = chatId ? await prisma.brexChat.findFirst({ where: { id: chatId, studentId: student.id }, select: { id: true } }) : null;
    if (chatId && !chat) return NextResponse.json({ message: "Conversa não encontrada." }, { status: 404 });
    const historyRows = chat ? await prisma.brexMessage.findMany({ where: { chatId: chat.id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 5 }) : [];
    const history = historyRows.reverse().map((item) => ({ role: item.role === "STUDENT" ? "user" : "assistant", content: decryptBrexMessage(item.encrypted) }));
    const encryptedQuery = encryptBrexMessage(query);
    const run = await reserveBrexRun(student.id, chatId);
    runId = run.id;
    const upstream = await brexFetch(settings.origin, "/v1/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: { query, history, user: { firstName: student.firstName, lastName: student.lastName, xp: student.xp, devCoins: student.devCoins } } }),
    });
    if (!upstream.ok) return NextResponse.json({ message: upstream.status === 503 ? "Brex está ocupado. Tente novamente." : "Brex não respondeu agora." }, { status: 503 });
    const result = await upstream.json();
    if (typeof result.answer !== "string" || !result.answer.trim() || result.answer.length > 20_000) throw new Error("BREX_BAD_RESPONSE");
    const inputTokens = result.usage?.inputTokens;
    const outputTokens = result.usage?.outputTokens;
    if (!Number.isSafeInteger(inputTokens) || !Number.isSafeInteger(outputTokens) || inputTokens < 0 || outputTokens < 0 || inputTokens + outputTokens > BREX_MESSAGE_TOKEN_LIMIT) throw new Error("BREX_TOKEN_LIMIT");
    const encryptedAnswer = encryptBrexMessage(result.answer);
    let saved: { chatId: string; title: string; messageId: string; createdAt: Date; quota: ReturnType<typeof currentBrexQuota>; chargedTokens: number } | undefined;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        saved = await prisma.$transaction(async (tx) => {
          const account = await tx.brexTokenAccount.findUnique({ where: { studentId: student.id }, select: { usedTokens: true, exhaustedAt: true } });
          const quota = currentBrexQuota(account);
          if (quota.remaining === 0) throw new Error("BREX_QUOTA_EXHAUSTED");
          const now = new Date();
          const debit = debitBrexQuota(quota, inputTokens + outputTokens, now);
          const conversation = chat ? await tx.brexChat.update({ where: { id: chat.id }, data: { updatedAt: now } }) : await tx.brexChat.create({ data: { studentId: student.id, title: brexTitle(query) } });
          await tx.brexMessage.create({ data: { chatId: conversation.id, role: "STUDENT", encrypted: encryptedQuery } });
          const message = await tx.brexMessage.create({ data: { chatId: conversation.id, role: "ASSISTANT", encrypted: encryptedAnswer, inputTokens, outputTokens } });
          await tx.brexTokenAccount.upsert({ where: { studentId: student.id }, create: { studentId: student.id, usedTokens: debit.usedTokens, exhaustedAt: debit.exhaustedAt }, update: { usedTokens: debit.usedTokens, exhaustedAt: debit.exhaustedAt } });
          return { chatId: conversation.id, title: conversation.title, messageId: message.id, createdAt: message.createdAt, chargedTokens: debit.chargedTokens, quota: debit.quota };
        }, { isolationLevel: "Serializable", timeout: 10_000 });
        break;
      } catch (error) {
        if ((error as { code?: string }).code === "P2034" && attempt < 3) continue;
        throw error;
      }
    }
    if (!saved) throw new Error("BREX_TRANSACTION_FAILED");
    return NextResponse.json({ ...saved, answer: result.answer, usage: { inputTokens, outputTokens, chargedTokens: saved.chargedTokens, limit: BREX_MESSAGE_TOKEN_LIMIT } });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "Escreva até 300 caracteres." }, { status: 400 });
    if (error instanceof Error) {
      if (error.message === "BREX_BUSY" || error.message === "BREX_STUDENT_BUSY") return NextResponse.json({ message: error.message === "BREX_STUDENT_BUSY" ? "Você já tem uma pergunta em processamento." : "Brex está processando três pedidos. Tente novamente em instantes." }, { status: 429 });
      if (error.message === "BREX_QUOTA_EXHAUSTED" && studentId) return NextResponse.json({ message: "Seus tokens acabaram. Aguarde a renovação.", quota: await brexTokenBalance(studentId) }, { status: 429 });
      if (error.message === "BREX_MESSAGE_KEY_NOT_CONFIGURED" || error.message === "BREX_API_TOKEN_NOT_CONFIGURED") return NextResponse.json({ message: "Brex aguarda configuração do servidor." }, { status: 503 });
    }
    const [message, status] = apiError(error);
    return NextResponse.json({ message }, { status });
  } finally {
    if (runId) await prisma.brexRun.delete({ where: { id: runId } }).catch(() => null);
  }
}
