import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { compare } from "bcryptjs";

const PREFIX = "lesson-code:v1";

function encryptionKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET deve ter pelo menos 32 caracteres.");
  return createHash("sha256").update(secret).digest();
}

export function protectLessonCode(code: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(code, "utf8"), cipher.final()]);
  return [PREFIX, iv.toString("base64url"), encrypted.toString("base64url"), cipher.getAuthTag().toString("base64url")].join(":");
}

export function revealLessonCode(protectedCode: string) {
  const [scope, version, ivValue, encryptedValue, tagValue] = protectedCode.split(":");
  if (`${scope}:${version}` !== PREFIX || !ivValue || !encryptedValue || !tagValue) return null;

  try {
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    const code = Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8");
    return /^\d{6}$/.test(code) ? code : null;
  } catch {
    return null;
  }
}

export async function verifyLessonCode(receivedCode: string, protectedCode: string) {
  const revealedCode = revealLessonCode(protectedCode);
  if (!revealedCode) return compare(receivedCode, protectedCode).catch(() => false);
  return timingSafeEqual(Buffer.from(receivedCode), Buffer.from(revealedCode));
}
