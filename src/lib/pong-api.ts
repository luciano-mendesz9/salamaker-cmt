import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { PongError } from "@/lib/pong-service";

export async function pongTransaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: "Serializable", maxWait: 10_000, timeout: 20_000 });
    } catch (error) {
      if ((error as { code?: string }).code === "P2034" && attempt < 2) continue;
      throw error;
    }
  }
  throw new Error("TRANSACTION_RETRY_EXHAUSTED");
}

export function pongErrorResponse(error: unknown) {
  const code = error instanceof PongError ? error.message : "UNKNOWN";
  if (code.startsWith("ACTIVE_ROOM:")) return { message: `Você já está na sala ${code.split(":")[2]}.`, status: 409 };
  if (code.startsWith("PENDING_REQUEST:")) return { message: `Você já pediu entrada na sala ${code.split(":")[1]}.`, status: 409 };
  const messages: Record<string, { message: string; status: number }> = {
    GAMES_DISABLED: { message: "Os minigames foram desativados pelo professor.", status: 403 },
    INVALID_WAGER: { message: "A aposta deve ser um número inteiro entre 10 e 100 Dev-Coins.", status: 400 },
    INVALID_CODE: { message: "Digite o código numérico de 6 dígitos.", status: 400 },
    ROOM_NOT_FOUND: { message: "Sala não encontrada.", status: 404 },
    ROOM_NOT_JOINABLE: { message: "Esta sala não aceita novas entradas.", status: 409 },
    ROOM_FULL: { message: "A sala já tem dois jogadores.", status: 409 },
    OWN_ROOM: { message: "Você já é o dono desta sala.", status: 409 },
    ALREADY_IN_ROOM: { message: "Você já está em outra sala.", status: 409 },
    GUEST_ALREADY_IN_ROOM: { message: "Este aluno já entrou em outra sala.", status: 409 },
    INSUFFICIENT_DEV_COINS: { message: "Saldo insuficiente para a taxa de 50 DC e a aposta escolhida.", status: 409 },
    GUEST_INSUFFICIENT_DEV_COINS: { message: "O convidado não possui Dev-Coins suficientes para esta aposta.", status: 409 },
    DAILY_ROOM_LIMIT: { message: "Você já criou 3 salas hoje.", status: 409 },
    ONLY_OWNER: { message: "Somente o dono da sala pode fazer isso.", status: 403 },
    JOIN_REQUEST_UNAVAILABLE: { message: "Este pedido de entrada expirou ou já foi respondido.", status: 409 },
    ROOM_ALREADY_STARTED: { message: "A partida já começou.", status: 409 },
    NOT_ENOUGH_PLAYERS: { message: "Aguarde o segundo jogador antes de iniciar.", status: 409 },
    PLAYER_NOT_CONNECTED: { message: "Os dois jogadores precisam estar conectados para iniciar.", status: 409 },
    PLAYER_UNAVAILABLE: { message: "Um dos jogadores não está disponível.", status: 409 },
    ROOM_NOT_ACTIVE: { message: "A partida não está ativa.", status: 409 },
    NOT_A_PLAYER: { message: "Você não pertence a esta sala.", status: 403 },
  };
  return messages[code] ?? { message: "Não foi possível concluir a operação do Pong.", status: 500 };
}
