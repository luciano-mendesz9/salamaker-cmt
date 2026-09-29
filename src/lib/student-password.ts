import { compare, hash } from "bcryptjs";

export const TEMPORARY_STUDENT_PASSWORD = "12345678";

export async function temporaryStudentPasswordData() {
  return { passwordHash: await hash(TEMPORARY_STUDENT_PASSWORD, 12), mustChangePassword: true, sessionVersion: { increment: 1 } as const };
}

export function validatePermanentPassword(password: string) {
  if (password.length < 8 || password.length > 72) throw new Error("A nova senha deve ter entre 8 e 72 caracteres.");
  if (password === TEMPORARY_STUDENT_PASSWORD) throw new Error("Escolha uma senha diferente da senha temporária.");
}

export async function verifyStudentPassword(password: unknown, passwordHash: string) {
  if (typeof password !== "string" || password.length < 1 || password.length > 72 || !(await compare(password, passwordHash))) {
    throw new Error("INVALID_STUDENT_PASSWORD");
  }
}
