function firstForwardedValue(value: string | null) {
  return value?.split(",", 1)[0]?.trim() || null;
}

function invalidOrigin(): never {
  throw new Error("INVALID_ORIGIN");
}

export function assertSameOrigin(request: Request) {
  const originHeader = request.headers.get("origin");
  const hostHeader = request.headers.get("host");
  if (!originHeader || !hostHeader) invalidOrigin();

  let origin: URL;
  let requestUrl: URL;
  try {
    origin = new URL(originHeader);
    requestUrl = new URL(request.url);
  } catch {
    invalidOrigin();
  }

  if (origin.origin !== originHeader || !["http:", "https:"].includes(origin.protocol)) {
    invalidOrigin();
  }

  const forwardedProtocol = firstForwardedValue(request.headers.get("x-forwarded-proto"));
  const expectedProtocol = forwardedProtocol ? `${forwardedProtocol.toLowerCase()}:` : requestUrl.protocol;

  let expectedHost: string;
  try {
    expectedHost = new URL(`${expectedProtocol}//${hostHeader}`).host;
  } catch {
    invalidOrigin();
  }

  if (origin.protocol !== expectedProtocol || origin.host !== expectedHost) invalidOrigin();
}
