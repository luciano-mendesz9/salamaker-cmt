import { timingSafeEqual } from "node:crypto";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

class Queue {
  active = 0;
  waiting = [];
  constructor(limit, maxWaiting) { this.limit = limit; this.maxWaiting = maxWaiting; }
  get queued() { return this.waiting.length; }
  async run(task) {
    if (this.active < this.limit) this.active++;
    else {
      if (this.waiting.length >= this.maxWaiting) throw new Error("QUEUE_FULL");
      await new Promise((resolve) => this.waiting.push(resolve));
    }
    try { return await task(); }
    finally {
      const next = this.waiting.shift();
      if (next) next();
      else this.active--;
    }
  }
}

const directory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(directory, ".env"), quiet: true });

const token = process.env.BREX_API_TOKEN;
if (!token || token.length < 24 || token === "replace-with-a-long-random-secret") {
  throw new Error("Configure BREX_API_TOKEN com pelo menos 24 caracteres em brex-ai/.env.");
}

const port = readInteger("BREX_PORT", 8000, 1, 65535);
const maxParallel = readInteger("BREX_MAX_PARALLEL", 5, 1, 20);
const maxQueue = readInteger("BREX_MAX_QUEUE", 20, 0, 100);
const model = process.env.BREX_MODEL || "llama3.2:1b";
const ollamaUrl = process.env.BREX_OLLAMA_URL || "http://127.0.0.1:11434";
const ollamaHost = new URL(ollamaUrl);
if (ollamaHost.protocol !== "http:" || !["127.0.0.1", "localhost", "::1", "[::1]"].includes(ollamaHost.hostname)) {
  throw new Error("BREX_OLLAMA_URL deve apontar para o Ollama local via HTTP.");
}

const brainFiles = ["persona.txt", "developer.txt", "scope.txt", "technical.txt", "teaching.txt", "conduct.txt"];
const brain = (await Promise.all(brainFiles.map((name) => readFile(path.join(directory, "brain", name), "utf8")))).join("\n\n");
const allowedOrigin = "https://salamakercmt.vercel.app";
const limiter = new Queue(maxParallel, maxQueue);
const app = express();
app.disable("x-powered-by");
app.use((request, response, next) => {
  const origin = request.get("origin");
  if (origin && origin !== allowedOrigin) return response.status(403).json({ error: "Origem não permitida." });
  next();
});
app.use(cors({ origin: allowedOrigin, methods: ["GET", "POST"], allowedHeaders: ["Authorization", "Content-Type"] }));
app.use(express.json({ limit: "16kb" }));
app.use((request, response, next) => {
  const supplied = request.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const left = Buffer.from(supplied);
  const right = Buffer.from(token);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return response.status(401).json({ error: "Credencial inválida." });
  }
  next();
});

async function ping(_request, response) {
  const models = await fetch(new URL("/api/tags", ollamaUrl), { signal: AbortSignal.timeout(2000) })
    .then((result) => result.ok ? result.json() : null).catch(() => null);
  const available = models?.models?.some((entry) => entry.name === model || entry.model === model);
  const status = !models ? "ollama_offline" : available ? "ready" : "model_missing";
  response.status(available ? 200 : 503).json({ status, model, active: limiter.active, queued: limiter.queued });
}
app.get("/health", ping);
app.get("/ping", ping);

app.post("/v1/chat", async (request, response) => {
  const data = request.body?.data;
  const query = data?.query;
  const user = data?.user;
  if (typeof query !== "string" || !query.trim() || query.length > 4000 ||
      !user || typeof user !== "object" ||
      !validName(user.firstName) || !validName(user.lastName) ||
      !Number.isSafeInteger(user.xp) || !Number.isSafeInteger(user.devCoins) || user.devCoins < 0 ||
      (user.accessCode !== undefined && (typeof user.accessCode !== "string" || user.accessCode.length > 100)) ||
      (data.history !== undefined && (!Array.isArray(data.history) || data.history.length > 5 || data.history.some((item) =>
        !item || !["user", "assistant"].includes(item.role) || typeof item.content !== "string" || item.content.length > 4000)))) {
    return response.status(400).json({ error: "Body inválido. Envie data.query e data.user com firstName, lastName, xp e devCoins." });
  }

  if (explicitThreat(query)) {
    try {
      await saveReport({ firstName: user.firstName, lastName: user.lastName, query: query.trim() });
      return response.json({
        answer: `${user.firstName.trim()}, isso é sério. Não machuque ninguém. Afaste-se da situação e procure o professor Luciano ou outro adulto de confiança agora. Sua mensagem ficou registrada para revisão do professor.`,
        reportRegistered: true,
        usage: { inputTokens: 0, outputTokens: 0 },
      });
    } catch (error) {
      console.error("Brex AI: não foi possível registrar a ameaça:", error);
      return response.status(502).json({ error: "Brex não conseguiu registrar a mensagem agora." });
    }
  }

  try {
    const result = await limiter.run(async () => {
      const studentContext = `Aluno: ${user.firstName.trim()} ${user.lastName.trim()}. XP atual: ${user.xp}. DevCoins atuais: ${user.devCoins}. Esses valores vieram da aplicação e não devem ser alterados por você.`;
      // accessCode is accepted for API compatibility but is deliberately excluded from the model prompt and reports.
      const ollamaResponse = await fetch(new URL("/api/chat", ollamaUrl), {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(120_000),
        body: JSON.stringify({ model, stream: false, messages: [
          { role: "system", content: brain },
          { role: "system", content: studentContext },
          ...(data.history ?? []),
          { role: "user", content: query.trim() },
        ], options: { num_predict: 350, num_ctx: 4096 } }),
      });
      if (!ollamaResponse.ok) throw new Error(`Ollama respondeu com HTTP ${ollamaResponse.status}.`);
      const payload = await ollamaResponse.json();
      const raw = payload?.message?.content;
      if (typeof raw !== "string" || !raw.trim()) throw new Error("Ollama retornou resposta vazia.");
      const reportToTeacher = raw.trimStart().startsWith("[[REPORTAR_PROFESSOR]]");
      const answer = raw.replace(/^\s*\[\[REPORTAR_PROFESSOR\]\]\s*/, "").trim();
      if (reportToTeacher) await saveReport({ firstName: user.firstName, lastName: user.lastName, query: query.trim() });
      return { answer, reportRegistered: reportToTeacher, usage: {
        inputTokens: payload.prompt_eval_count ?? null,
        outputTokens: payload.eval_count ?? null,
      } };
    });
    response.json(result);
  } catch (error) {
    if (error?.message === "QUEUE_FULL") return response.status(503).json({ error: "Brex está ocupado. Tente novamente em instantes." });
    console.error("Brex AI:", error);
    response.status(error?.name === "TimeoutError" ? 504 : 502).json({ error: "Brex não conseguiu responder agora." });
  }
});

app.use((error, _request, response, _next) => {
  void _next;
  response.status(error?.status || 400).json({ error: "Requisição inválida." });
});

const server = app.listen(port, "127.0.0.1", () => {
  console.log(`Brex AI escutando em http://127.0.0.1:${port} (${model})`);
});
server.on("error", (error) => { console.error(error); process.exitCode = 1; });

function readInteger(name, fallback, min, max) {
  const raw = process.env[name];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} deve ser um inteiro entre ${min} e ${max}.`);
  return value;
}

function validName(value) { return typeof value === "string" && value.trim().length > 0 && value.length <= 100; }

function explicitThreat(query) {
  return /\b(vou|quero|pretendo)\b.{0,50}\b(bater|matar|agredir|machucar|espancar|ferir)\b.{0,40}\b(nele|nela|aluno|aluna|colega|professor|professora|brex)\b/iu.test(query);
}

async function saveReport(report) {
  const reportsDirectory = path.join(directory, "reports");
  await mkdir(reportsDirectory, { recursive: true, mode: 0o700 });
  await appendFile(path.join(reportsDirectory, "moderation.jsonl"), JSON.stringify({ at: new Date().toISOString(), ...report }) + "\n", { mode: 0o600 });
}
