import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";

const directory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(directory, ".env"), quiet: true });
const ollamaUrl = process.env.BREX_OLLAMA_URL || "http://127.0.0.1:11434";
const url = new URL(ollamaUrl);
if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname)) {
  throw new Error("BREX_OLLAMA_URL deve apontar para o Ollama local via HTTP.");
}

let ollamaProcess;
let expressProcess;
const isReady = () => fetch(new URL("/api/version", ollamaUrl), { signal: AbortSignal.timeout(1500) }).then((result) => result.ok).catch(() => false);

if (!(await isReady())) {
  console.log("Ollama inativo. Iniciando ollama serve...");
  ollamaProcess = spawn("ollama", ["serve"], {
    env: { ...process.env, OLLAMA_HOST: url.host },
    stdio: "inherit",
  });
  ollamaProcess.on("error", (error) => console.error("Não foi possível iniciar Ollama:", error.message));
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    if (await isReady()) { ready = true; break; }
    if (ollamaProcess.exitCode !== null) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready) {
    ollamaProcess.kill("SIGTERM");
    throw new Error("Ollama não iniciou em 20 segundos. Verifique 'ollama serve' e a porta configurada.");
  }
} else console.log("Ollama já está ativo.");

const model = process.env.BREX_MODEL || "llama3.2:1b";
const models = await fetch(new URL("/api/tags", ollamaUrl), { signal: AbortSignal.timeout(3000) })
  .then((result) => result.json())
  .catch(() => ({ models: [] }));
if (!models.models?.some((entry) => entry.name === model || entry.model === model)) {
  ollamaProcess?.kill("SIGTERM");
  throw new Error(`Modelo ${model} não encontrado nesta instância do Ollama. Execute 'ollama pull ${model}' enquanto ela estiver ativa.`);
}

expressProcess = spawn(process.execPath, [path.join(directory, "server.mjs")], { stdio: "inherit", env: process.env });
expressProcess.on("exit", (code) => {
  ollamaProcess?.kill("SIGTERM");
  process.exit(code ?? 1);
});
expressProcess.on("error", (error) => {
  console.error("Não foi possível iniciar o servidor Express:", error.message);
  ollamaProcess?.kill("SIGTERM");
  process.exit(1);
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    expressProcess?.kill(signal);
    ollamaProcess?.kill(signal);
  });
}
