import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { hash } from "bcryptjs";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import WebSocket from "ws";
import { PrismaClient, Role, UserStatus } from "../src/generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL não está configurada.");

neonConfig.webSocketConstructor = WebSocket;
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: databaseUrl }) });
const rl = createInterface({ input: stdin, output: stdout });

function argument(name: "firstName" | "lastName" | "password") {
  const expected = `--${name}`.toLowerCase();
  for (let index = 2; index < process.argv.length; index += 1) {
    const current = process.argv[index];
    const [flag, inlineValue] = current.split("=", 2);
    if (flag.toLowerCase() !== expected) continue;
    const value = inlineValue ?? process.argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Informe um valor para --${name}.`);
    return value;
  }

  // npm 9 also exposes options placed directly after the script as npm_config_*.
  const npmValue = process.env[`npm_config_${name.toLowerCase()}`];
  if (npmValue) return npmValue;

  // `npm run script --name value` on npm 9 forwards only the values, in order.
  const position = { firstName: 2, lastName: 3, password: 4 }[name];
  if (process.argv.slice(2).every((value) => !value.startsWith("--"))) return process.argv[position];
}

function cleanName(value: string, field: string) {
  const clean = value.trim().replace(/\s+/g, " ");
  if (clean.length < 2 || clean.length > 80) throw new Error(`${field} deve ter entre 2 e 80 caracteres.`);
  return clean;
}

async function askPassword() {
  if (!stdin.isTTY) return rl.question("Senha: ");
  stdout.write("Senha: ");
  stdin.setRawMode(true);
  stdin.resume();
  let password = "";
  return new Promise<string>((resolve, reject) => {
    const onData = (buffer: Buffer) => {
      for (const char of buffer.toString("utf8")) {
        if (char === "\u0003") { cleanup(); reject(new Error("Operação cancelada.")); return; }
        if (char === "\r" || char === "\n") { stdout.write("\n"); cleanup(); resolve(password); return; }
        if (char === "\u007f") { if (password) { password = password.slice(0, -1); stdout.write("\b \b"); } continue; }
        if (char >= " ") { password += char; stdout.write("•"); }
      }
    };
    const cleanup = () => { stdin.off("data", onData); stdin.setRawMode(false); stdin.pause(); };
    stdin.on("data", onData);
  });
}

async function main() {
  const firstName = cleanName(argument("firstName") ?? await rl.question("Nome: "), "Nome");
  const lastName = cleanName(argument("lastName") ?? await rl.question("Sobrenome: "), "Sobrenome");
  const passwordArgument = argument("password");
  // Stop readline's terminal renderer before collecting the secret in raw mode.
  if (stdin.isTTY) rl.close();
  const password = passwordArgument ?? await askPassword();
  if (password.length < 8 || password.length > 72) throw new Error("A senha deve ter entre 8 e 72 caracteres.");
  const passwordHash = await hash(password, 12);
  const year = new Date().getFullYear();
  const teacher = await prisma.$transaction(async (tx) => {
    const sequence = await tx.accessCodeSequence.upsert({ where: { year }, create: { year, nextValue: 2 }, update: { nextValue: { increment: 1 } }, select: { nextValue: true } });
    const accessCode = `PROF${year}${String(sequence.nextValue - 1).padStart(4, "0")}`;
    return tx.user.create({ data: { firstName, lastName, passwordHash, accessCode, role: Role.TEACHER, status: UserStatus.ACTIVE, mustChangePassword: false }, select: { firstName: true, lastName: true, accessCode: true } });
  });
  stdout.write(`\nProfessor criado com sucesso.\nNome: ${teacher.firstName} ${teacher.lastName}\nCódigo de acesso: ${teacher.accessCode}\n`);
}

main().catch((error) => { process.exitCode = 1; console.error(`\nNão foi possível criar o professor: ${error instanceof Error ? error.message : "erro desconhecido"}`); }).finally(async () => { if (!stdin.isTTY) rl.close(); await prisma.$disconnect(); });
