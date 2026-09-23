import { hash } from "bcryptjs";

export const TEMPORARY_STUDENT_PASSWORD = "12345678";

export async function temporaryStudentPasswordData() {
  return { passwordHash: await hash(TEMPORARY_STUDENT_PASSWORD, 12), mustChangePassword: true, sessionVersion: { increment: 1 } as const };
}

export function validatePermanentPassword(password: string) {
  if (password.length < 8 || password.length > 72) throw new Error("A nova senha deve ter entre 8 e 72 caracteres.");
  if (password === TEMPORARY_STUDENT_PASSWORD) throw new Error("Escolha uma senha diferente da senha temporária.");
}
