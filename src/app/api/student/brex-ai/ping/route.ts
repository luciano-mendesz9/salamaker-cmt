import { NextResponse } from "next/server";
import { apiError, requireStudent } from "@/lib/authorization";
import { brexFetch, brexSettings, brexTokenBalance } from "@/lib/brex-ai";

export async function GET() {
  try {
    const { student } = await requireStudent();
    const [settings, quota] = await Promise.all([brexSettings(), brexTokenBalance(student.id)]);
    if (!settings?.enabled || !settings.origin) return NextResponse.json({ active: false, version: settings?.version ?? "0.1.0", quota });
    const response = await brexFetch(settings.origin, "/ping").catch(() => null);
    return NextResponse.json({ active: Boolean(response?.ok), version: settings.version, quota });
  } catch (error) {
    const [message, status] = apiError(error);
    return NextResponse.json({ message }, { status });
  }
}
