import assert from "node:assert/strict";
import test from "node:test";
import { assertSameOrigin } from "./same-origin";

function request(url: string, headers: Record<string, string>) {
  return new Request(url, { method: "POST", headers });
}

test("accepts a request whose browser origin matches its public Host header", () => {
  assert.doesNotThrow(() => assertSameOrigin(request("http://0.0.0.0:3000/api/action", {
    host: "localhost:3000",
    origin: "http://localhost:3000",
  })));
});

test("accepts the public HTTPS protocol supplied by a trusted reverse proxy", () => {
  assert.doesNotThrow(() => assertSameOrigin(request("http://127.0.0.1:3000/api/action", {
    host: "sala-maker.example",
    origin: "https://sala-maker.example",
    "x-forwarded-proto": "https",
  })));
});

test("rejects a cross-site origin even when the internal request URL differs", () => {
  assert.throws(() => assertSameOrigin(request("http://0.0.0.0:3000/api/action", {
    host: "localhost:3000",
    origin: "https://example.net",
  })), /INVALID_ORIGIN/);
});

test("rejects missing, malformed, or protocol-mismatched origins", () => {
  assert.throws(() => assertSameOrigin(request("http://localhost:3000/api/action", {
    host: "localhost:3000",
  })), /INVALID_ORIGIN/);
  assert.throws(() => assertSameOrigin(request("http://localhost:3000/api/action", {
    host: "localhost:3000",
    origin: "null",
  })), /INVALID_ORIGIN/);
  assert.throws(() => assertSameOrigin(request("http://localhost:3000/api/action", {
    host: "localhost:3000",
    origin: "https://localhost:3000",
  })), /INVALID_ORIGIN/);
});
