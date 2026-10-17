import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { apiError } from "@/lib/authorization";
import { TicTacToeError } from "@/lib/tic-tac-toe-service";

export function ticTacToeJsonError(error: unknown) {
  if (error instanceof ZodError) return NextResponse.json({ message: "Dados do jogo da velha inválidos." }, { status: 400 });
  const code = error instanceof TicTacToeError ? error.message : error instanceof Error ? error.message : "UNKNOWN";
  if (code.startsWith("ACTIVE_ROOM:")) return NextResponse.json({ message: `Você já está na sala ${code.split(":")[2]}.` }, { status: 409 });
  const messages: Record<string, [string, number]> = {
    GAMES_DISABLED: ["Os minigames foram desativados pelo professor.", 403],
    INVALID_WAGER: ["A aposta deve ser um número inteiro entre 11 e 500 Dev-Coins.", 400],
    INVALID_CODE: ["Digite o código numérico de 6 dígitos.", 400],
    ROOM_NOT_FOUND: ["Sala não encontrada.", 404],
    ROOM_NOT_JOINABLE: ["Esta sala não aceita novas entradas.", 409],
    OWN_ROOM: ["Você já é o dono desta sala.", 409],
    ALREADY_IN_ROOM: ["Você já está em outra sala de jogo da velha.", 409],
    INSUFFICIENT_DEV_COINS: ["Seu saldo não cobre a aposta.", 409],
    GUEST_INSUFFICIENT_DEV_COINS: ["O outro jogador não possui saldo para repetir a aposta.", 409],
    NOT_ENOUGH_PLAYERS: ["Aguarde o segundo jogador.", 409],
    NOT_A_PLAYER: ["Você não pertence a esta sala.", 403],
    ROOM_NOT_ACTIVE: ["A partida não está ativa.", 409],
    ROOM_NOT_FINISHED: ["A revanche só pode ser pedida no fim da partida.", 409],
    NOT_YOUR_TURN: ["Aguarde a sua vez.", 409],
    INVALID_CELL: ["Casa inválida.", 400],
    CELL_OCCUPIED: ["Essa casa já está ocupada.", 409],
    ONLY_OWNER: ["Somente o criador pode cancelar a sala.", 403],
    ROOM_ALREADY_STARTED: ["A partida já começou.", 409],
  };
  if (messages[code]) return NextResponse.json({ message: messages[code][0] }, { status: messages[code][1] });
  if ((error as { code?: string }).code === "P2028") return NextResponse.json({ message: "O banco demorou para responder. Tente novamente." }, { status: 503 });
  const [message, status] = apiError(error);
  return NextResponse.json({ message }, { status });
}
