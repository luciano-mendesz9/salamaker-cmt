import assert from "node:assert/strict";
import test from "node:test";
import { requestHasSameOrigin } from "./request-origin";

function request(url: string, headers: Record<string, string>) {
  return new Request(url, { headers });
}

test("accepts the browser host when the local server is bound to 0.0.0.0", () => {
  assert.equal(requestHasSameOrigin(request("http://0.0.0.0:3000/api/room", {
    host: "localhost:3000",
    origin: "http://localhost:3000",
  })), true);
  assert.equal(requestHasSameOrigin(request("http://0.0.0.0:3000/api/room", {
    host: "127.0.0.1:3000",
    origin: "http://127.0.0.1:3000",
  })), true);
});

test("accepts the public forwarded origin behind a trusted deployment proxy", () => {
  assert.equal(requestHasSameOrigin(request("http://internal:3000/api/room", {
    host: "internal:3000",
    origin: "https://sala.example.com",
    "x-forwarded-host": "sala.example.com",
    "x-forwarded-proto": "https",
  })), true);
});

test("rejects absent, malformed, and foreign origins", () => {
  assert.equal(requestHasSameOrigin(request("http://localhost:3000/api/room", { host: "localhost:3000" })), false);
  assert.equal(requestHasSameOrigin(request("http://localhost:3000/api/room", {
    host: "localhost:3000",
    origin: "null",
  })), false);
  assert.equal(requestHasSameOrigin(request("http://localhost:3000/api/room", {
    host: "localhost:3000",
    origin: "https://evil.example",
  })), false);
});
