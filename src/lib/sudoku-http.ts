import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { apiError } from "@/lib/authorization";
import { SudokuError } from "@/lib/sudoku-service";

export function sudokuJsonError(error: unknown) {
  if (error instanceof ZodError) return NextResponse.json({ message: "Dados do Sudoku inválidos." }, { status: 400 });
  const code = error instanceof SudokuError ? error.message : "UNKNOWN";
  const messages: Record<string, [string, number]> = {
    GAMES_DISABLED: ["Os minigames foram desativados pelo professor.", 403],
    INVALID_DIFFICULTY: ["Escolha uma dificuldade válida.", 400],
    GAME_NOT_FOUND: ["Partida de Sudoku não encontrada.", 404],
    GAME_NOT_ACTIVE: ["Esta partida já foi encerrada.", 409],
    INVALID_MOVE: ["Jogada inválida.", 400],
    FIXED_CELL: ["Os números iniciais do tabuleiro não podem ser alterados.", 409],
    CELL_ALREADY_SOLVED: ["Essa casa já foi resolvida.", 409],
    NO_HINTS_LEFT: ["Você já usou as 3 dicas desta partida.", 409],
    NO_EMPTY_CELLS: ["Não há casas vazias.", 409],
    EXTRA_ERRORS_ALREADY_PURCHASED: ["Os 2 erros extras já foram comprados nesta partida.", 409],
    INSUFFICIENT_DEV_COINS: ["Saldo de Dev-Coins insuficiente.", 409],
  };
  if (messages[code]) return NextResponse.json({ message: messages[code][0] }, { status: messages[code][1] });
  if ((error as { code?: string }).code === "P2028") return NextResponse.json({ message: "O banco demorou para responder. Tente novamente." }, { status: 503 });
  const [message, status] = apiError(error);
  return NextResponse.json({ message }, { status });
}
