export const TIC_TAC_TOE_MIN_WAGER = 11;
export const TIC_TAC_TOE_MAX_WAGER = 500;
export const TIC_TAC_TOE_WIN_XP = 25;
export const TIC_TAC_TOE_SOLO_REDUCED_XP = 15;
export const TIC_TAC_TOE_SOLO_FULL_XP_MATCHES = 5;
export const TIC_TAC_TOE_MACHINE_PERFECT_MOVE_CHANCE = 0.99;

export type TicTacToeCell = "X" | "O" | "-";
export type TicTacToeMark = Exclude<TicTacToeCell, "-">;

export const TIC_TAC_TOE_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
] as const;

export function parseTicTacToeBoard(board: string): TicTacToeCell[] {
  if (!/^[XO-]{9}$/.test(board)) throw new Error("INVALID_BOARD");
  return [...board] as TicTacToeCell[];
}

export function ticTacToeWinner(board: string): TicTacToeMark | null {
  const cells = parseTicTacToeBoard(board);
  for (const [a, b, c] of TIC_TAC_TOE_LINES) {
    if (cells[a] !== "-" && cells[a] === cells[b] && cells[a] === cells[c]) return cells[a] as TicTacToeMark;
  }
  return null;
}

export function ticTacToeFinished(board: string) {
  return ticTacToeWinner(board) !== null || !board.includes("-");
}

export function applyTicTacToeMove(board: string, cell: number, mark: TicTacToeMark) {
  const cells = parseTicTacToeBoard(board);
  if (!Number.isInteger(cell) || cell < 0 || cell > 8) throw new Error("INVALID_CELL");
  if (cells[cell] !== "-") throw new Error("CELL_OCCUPIED");
  cells[cell] = mark;
  return cells.join("");
}

export function ticTacToeSettlement(wager: number) {
  if (!Number.isInteger(wager) || wager < TIC_TAC_TOE_MIN_WAGER || wager > TIC_TAC_TOE_MAX_WAGER) throw new Error("INVALID_WAGER");
  const total = wager * 2;
  const winnerPayout = Math.floor(total * 0.85);
  return { total, winnerPayout, taxAmount: total - winnerPayout };
}

function minimax(board: string, machine: TicTacToeMark, human: TicTacToeMark, maximizing: boolean): number {
  const winner = ticTacToeWinner(board);
  if (winner === machine) return 10;
  if (winner === human) return -10;
  if (!board.includes("-")) return 0;
  const scores: number[] = [];
  for (let cell = 0; cell < 9; cell += 1) {
    if (board[cell] !== "-") continue;
    scores.push(minimax(applyTicTacToeMove(board, cell, maximizing ? machine : human), machine, human, !maximizing));
  }
  return maximizing ? Math.max(...scores) : Math.min(...scores);
}

export function bestTicTacToeMove(board: string, machine: TicTacToeMark): number {
  if (ticTacToeFinished(board)) throw new Error("GAME_FINISHED");
  const human: TicTacToeMark = machine === "X" ? "O" : "X";
  let bestScore = -Infinity;
  let bestCell = -1;
  const preferredOrder = [4, 0, 2, 6, 8, 1, 3, 5, 7];
  for (const cell of preferredOrder) {
    if (board[cell] !== "-") continue;
    const score = minimax(applyTicTacToeMove(board, cell, machine), machine, human, false);
    if (score > bestScore) {
      bestScore = score;
      bestCell = cell;
    }
  }
  return bestCell;
}

export function ticTacToeMachineMove(board: string, skillRoll: number, choiceRoll: number): number {
  const best = bestTicTacToeMove(board, "O");
  if (skillRoll < TIC_TAC_TOE_MACHINE_PERFECT_MOVE_CHANCE) return best;
  const alternatives = [...board].flatMap((cell, index) => cell === "-" && index !== best ? [index] : []);
  if (alternatives.length === 0) return best;
  const normalized = Math.min(Math.max(choiceRoll, 0), 0.999999);
  return alternatives[Math.floor(normalized * alternatives.length)];
}

export function ticTacToeSoloXpAward(finishedMatchesToday: number) {
  return finishedMatchesToday >= TIC_TAC_TOE_SOLO_FULL_XP_MATCHES ? TIC_TAC_TOE_SOLO_REDUCED_XP : TIC_TAC_TOE_WIN_XP;
}
