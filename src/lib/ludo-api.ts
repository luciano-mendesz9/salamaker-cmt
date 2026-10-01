import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { LudoError } from "@/lib/ludo-service";

export async function ludoTransaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) {
  const { prisma } = await import("@/lib/db");
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

export function ludoRoomDto(room: Prisma.LudoRoomGetPayload<{
  include: {
    owner: { select: { id: true; firstName: true; lastName: true } };
    players: { include: { student: { select: { id: true; firstName: true; lastName: true; profileAvatar: true; xp: true; devCoins: true } } } };
    moves: true;
  };
}>, viewerId: string) {
  const viewer = room.players.find(player => player.studentId === viewerId)?.student;
  return {
    id: room.id,
    code: room.code,
    ownerId: room.ownerId,
    ownerName: `${room.owner.firstName} ${room.owner.lastName}`,
    mode: room.mode,
    status: room.status,
    wager: room.wager,
    roomFee: room.roomFee,
    maxPlayers: room.maxPlayers,
    initialPlayerCount: room.initialPlayerCount,
    currentSeat: room.currentSeat,
    currentRoll: room.currentRoll,
    pauseRequestCount: room.pauseRequestCount,
    turnDeadline: room.turnDeadline?.toISOString() ?? null,
    startedAt: room.startedAt?.toISOString() ?? null,
    pausedAt: room.pausedAt?.toISOString() ?? null,
    finishedAt: room.finishedAt?.toISOString() ?? null,
    createdAt: room.createdAt.toISOString(),
    version: room.version,
    viewer: viewer ? { xp: viewer.xp, devCoins: viewer.devCoins } : null,
    players: room.players.map(player => ({
      id: player.id,
      studentId: player.studentId,
      kind: player.kind,
      name: player.student ? `${player.student.firstName} ${player.student.lastName}` : "IA do Professor",
      profileAvatar: player.student?.profileAvatar ?? "default",
      color: player.color,
      seat: player.seat,
      status: player.status,
      pieces: player.pieces,
      stake: player.stake,
      payout: player.payout,
      finishPosition: player.finishPosition,
      connected: player.kind === "BOT" ? true : player.connected,
      disconnectedAt: player.disconnectedAt?.toISOString() ?? null,
    })),
    moves: room.moves.map(move => ({
      id: move.id,
      playerId: move.playerId,
      sequence: move.sequence,
      kind: move.kind,
      roll: move.roll,
      pieceIndex: move.pieceIndex,
      fromPosition: move.fromPosition,
      toPosition: move.toPosition,
      captured: move.captured,
      autoReason: move.autoReason,
      createdAt: move.createdAt.toISOString(),
    })),
  };
}

export function ludoApiError(error: unknown) {
  if ((error as { name?: string }).name === "ZodError") return NextResponse.json({ message: "Revise os dados enviados." }, { status: 400 });
  if ((error as { code?: string }).code === "P2021" || (error as { code?: string }).code === "P2022") return NextResponse.json({ message: "O Ludo Maker aguarda a migration do banco de dados." }, { status: 503 });
  const code = error instanceof Error ? error.message : "UNKNOWN";
  if (code.startsWith("ACTIVE_ROOM:")) return NextResponse.json({ message: `Você já participa da sala ${code.split(":")[1]}.`, code: "ACTIVE_ROOM", roomCode: code.split(":")[1] }, { status: 409 });
  const messages: Record<string, [string, number]> = {
    INVALID_WAGER: ["Escolha uma aposta entre 10 e 100 Dev-Coins.", 400],
    LUDO_REALTIME_NOT_CONFIGURED: ["O Ludo Maker aguarda a conexão Redis do tempo real.", 503],
    INSUFFICIENT_DEV_COINS: ["Você não possui Dev-Coins suficientes para a taxa e a aposta.", 409],
    INSUFFICIENT_TREASURY: ["O caixa do professor não possui Dev-Coins suficientes para financiar a IA.", 409],
    ROOM_NOT_FOUND: ["Sala não encontrada.", 404],
    ROOM_NOT_JOINABLE: ["Esta sala não aceita mais jogadores.", 409],
    ROOM_FULL: ["A sala já possui quatro jogadores.", 409],
    ALREADY_IN_ANOTHER_ROOM: ["Você já participa de outra sala em andamento.", 409],
    ONLY_OWNER: ["Somente o dono da sala pode realizar esta ação.", 403],
    ROOM_ALREADY_STARTED: ["A partida já começou.", 409],
    NOT_ENOUGH_PLAYERS: ["É necessário ter ao menos dois jogadores.", 409],
    ROOM_NOT_ACTIVE: ["A partida não está ativa.", 409],
    ROOM_NOT_PAUSED: ["A partida não está pausada.", 409],
    NOT_YOUR_TURN: ["Aguarde a sua vez.", 409],
    ROLL_ALREADY_EXISTS: ["Escolha uma peça antes de sortear novamente.", 409],
    MOVE_NOT_AVAILABLE: ["Não há movimento disponível agora.", 409],
    INVALID_PIECE_MOVE: ["Esta peça não pode ser movimentada com o número sorteado.", 409],
    NOT_A_PLAYER: ["Você não participa desta sala.", 403],
    NOT_AN_ACTIVE_PLAYER: ["Você não é um jogador ativo nesta partida.", 409],
    CANNOT_INVITE_SELF: ["Você não pode convidar a própria conta.", 400],
    ALREADY_IN_ROOM: ["Esse aluno já está na sala.", 409],
    STUDENT_UNAVAILABLE: ["Esse aluno não está disponível.", 404],
    INVITATIONS_BLOCKED: ["Esse aluno bloqueou seus convites por dez minutos.", 403],
    INVITATION_PENDING: ["Já existe um convite aguardando resposta.", 409],
    INVITATION_UNAVAILABLE: ["Este convite expirou ou já foi respondido.", 409],
    NO_VALID_MOVE: ["Nenhuma peça pode ser movimentada.", 409],
    UNAUTHORIZED: ["Sessão expirada.", 401],
    FORBIDDEN: ["Acesso negado.", 403],
    INVALID_ORIGIN: ["Origem da solicitação inválida.", 403],
    RATE_LIMITED: ["Muitas tentativas. Aguarde um pouco.", 429],
  };
  const [message, status] = messages[code] ?? [error instanceof LudoError ? "A ação não é permitida nesta partida." : "Não foi possível concluir a ação no Ludo Maker.", 500];
  return NextResponse.json({ message, code }, { status });
}
