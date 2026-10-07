import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { apiError } from "@/lib/authorization";
import { pongErrorResponse } from "@/lib/pong-api";
import { PongError } from "@/lib/pong-service";

export function pongJsonError(error: unknown) {
  if (error instanceof ZodError) return NextResponse.json({ message: "Dados do Pong inválidos." }, { status: 400 });
  if (error instanceof PongError) {
    const mapped = pongErrorResponse(error);
    return NextResponse.json({ message: mapped.message }, { status: mapped.status });
  }
  if ((error as { code?: string }).code === "P2028") {
    return NextResponse.json({ message: "O banco demorou para responder. Nenhum saldo foi alterado; tente novamente." }, { status: 503 });
  }
  const [message, status] = apiError(error);
  return NextResponse.json({ message }, { status });
}
