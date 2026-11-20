import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { currentBrexQuota } from "@/lib/brex-token-quota";

export const BREX_MESSAGE_TOKEN_LIMIT = 10_000;
export const BREX_MAX_ACTIVE = 3;

export async function brexTokenBalance(studentId: string) {
  const account = await prisma.brexTokenAccount.findUnique({ where: { studentId }, select: { usedTokens: true, exhaustedAt: true } });
  return currentBrexQuota(account);
}

function encryptionKey() {
  const raw = process.env.BREX_MESSAGE_KEY;
  if (!raw || !/^[a-f\d]{64}$/i.test(raw)) throw new Error("BREX_MESSAGE_KEY_NOT_CONFIGURED");
  return Buffer.from(raw, "hex");
}

export function encryptBrexMessage(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${body.toString("base64url")}`;
}

export function decryptBrexMessage(value: string) {
  const [version, iv, tag, body] = value.split(".");
  if (version !== "v1" || !iv || !tag || body === undefined) throw new Error("BREX_MESSAGE_INVALID");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
}

export function validBrexOrigin(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash &&
      /(^|\.)(ngrok-free\.(app|dev)|ngrok\.(app|dev))$/i.test(url.hostname);
  } catch { return false; }
}

export async function brexSettings() {
  return prisma.brexSetting.findUnique({ where: { id: 1 } });
}

export async function brexFetch(origin: string, path: "/ping" | "/v1/chat", init?: RequestInit) {
  if (!validBrexOrigin(origin)) throw new Error("BREX_ORIGIN_INVALID");
  const token = process.env.BREX_API_TOKEN;
  if (!token) throw new Error("BREX_API_TOKEN_NOT_CONFIGURED");
  return fetch(new URL(path, origin), {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(path === "/ping" ? 5000 : 150_000),
  });
}

export function brexTitle(query: string) {
  return query.trim().split(/\s+/u).slice(0, 2).join(" ");
}

export async function reserveBrexRun(studentId: string, chatId: string | null) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        await tx.brexRun.deleteMany({ where: { expiresAt: { lt: new Date() } } });
        if (await tx.brexRun.count() >= BREX_MAX_ACTIVE) throw new Error("BREX_BUSY");
        if (await tx.brexRun.count({ where: { studentId } })) throw new Error("BREX_STUDENT_BUSY");
        const account = await tx.brexTokenAccount.findUnique({ where: { studentId }, select: { usedTokens: true, exhaustedAt: true } });
        const quota = currentBrexQuota(account);
        if (quota.remaining === 0) throw new Error("BREX_QUOTA_EXHAUSTED");
        if (account?.exhaustedAt && quota.refreshAt === null) await tx.brexTokenAccount.update({ where: { studentId }, data: { usedTokens: 0, exhaustedAt: null } });
        return tx.brexRun.create({ data: { studentId, chatId, expiresAt: new Date(Date.now() + 180_000) } });
      }, { isolationLevel: "Serializable", timeout: 10_000 });
    } catch (error) {
      if ((error as { code?: string }).code === "P2034" && attempt < 3) continue;
      throw error;
    }
  }
  throw new Error("BREX_BUSY");
}
