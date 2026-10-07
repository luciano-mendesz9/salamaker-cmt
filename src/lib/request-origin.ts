function firstForwardedValue(value: string | null) {
  return value?.split(",", 1)[0]?.trim() || null;
}

function normalizedHttpOrigin(protocol: string, host: string) {
  if (protocol !== "http" && protocol !== "https") return null;
  try { return new URL(`${protocol}://${host}`).origin; } catch { return null; }
}

export function requestHasSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  let receivedOrigin: string;
  let requestUrl: URL;
  try {
    receivedOrigin = new URL(origin).origin;
    requestUrl = new URL(request.url);
  } catch {
    return false;
  }

  const candidates = new Set([requestUrl.origin]);
  const forwardedHost = firstForwardedValue(request.headers.get("x-forwarded-host"));
  const host = request.headers.get("host");
  const forwardedProtocol = firstForwardedValue(request.headers.get("x-forwarded-proto"));
  const requestProtocol = requestUrl.protocol.slice(0, -1);

  for (const candidateHost of [forwardedHost, host]) {
    if (!candidateHost) continue;
    for (const candidateProtocol of [forwardedProtocol, requestProtocol]) {
      if (!candidateProtocol) continue;
      const candidate = normalizedHttpOrigin(candidateProtocol, candidateHost);
      if (candidate) candidates.add(candidate);
    }
  }

  return candidates.has(receivedOrigin);
}
