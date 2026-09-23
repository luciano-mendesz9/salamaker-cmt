import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { readSessionToken, SESSION_COOKIE } from "@/lib/session";

export async function requireTeacher() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) throw new Error("UNAUTHORIZED");
  const session = await readSessionToken(token).catch(() => null);
  if (!session || session.role !== "TEACHER") throw new Error("FORBIDDEN");
  const teacher = await prisma.user.findFirst({ where: { id: session.userId, role: "TEACHER", status: "ACTIVE", sessionVersion: session.version } });
  if (!teacher) throw new Error("UNAUTHORIZED");
  return teacher;
}
export async function requireStudent() {
  const token=(await cookies()).get(SESSION_COOKIE)?.value;if(!token)throw new Error("UNAUTHORIZED");
  const session=await readSessionToken(token).catch(()=>null);if(!session||session.role!=="STUDENT")throw new Error("FORBIDDEN");
  const student=await prisma.user.findFirst({where:{id:session.userId,role:"STUDENT",status:"ACTIVE",sessionVersion:session.version}});if(!student)throw new Error("UNAUTHORIZED");return {student,session};
}

export function verifyAdminActionPassword(value: unknown) {
  const expected = process.env.ADMIN_ACTION_PASSWORD;
  if (!expected || expected.length < 8) throw new Error("ADMIN_PASSWORD_NOT_CONFIGURED");
  const received = typeof value === "string" ? value : "";
  const left = Buffer.from(received); const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new Error("INVALID_ADMIN_PASSWORD");
}

export function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  const map: Record<string, [string, number]> = {
    UNAUTHORIZED: ["Sessão expirada.", 401], FORBIDDEN: ["Acesso negado.", 403],
    INVALID_ADMIN_PASSWORD: ["Senha administrativa incorreta.", 403],
    ADMIN_PASSWORD_NOT_CONFIGURED: ["Configure ADMIN_ACTION_PASSWORD no ambiente.", 503],
  };
  return map[message] ?? ["Não foi possível concluir a operação.", 500];
}
