import { HTTP_LIMITS } from "@lista/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance, InjectOptions } from "fastify";
import { buildTestApp, TEST_ORIGIN } from "./app";
import { useTestDatabase } from "./database";
import { randomIp } from "./factories";
import { captureLogs } from "./logs";

const VALIDATION_FAILED = { error: { code: "validation_failed" } };

// T-086: błędy klienta wykryte przez Fastify, zanim żądanie dojdzie do trasy, mają format błędu
// API (architecture.md, „Konwencje API i błędów”), bez `message` Fastify i fragmentów treści.
describe("client errors raised by Fastify use the API error format (T-086)", () => {
  const db = useTestDatabase();
  const logs = captureLogs();
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildTestApp(db.pool, { logger: { level: "info", stream: logs.stream } });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const send = (options: InjectOptions) =>
    app.inject({
      remoteAddress: randomIp(),
      ...options,
      headers: { origin: TEST_ORIGIN, ...options.headers },
    });

  const routes = ["/api/v1/lists", "/api/auth/sign-in/email"];
  const json = { "content-type": "application/json" };
  const badBodies: [string, string][] = [
    ["truncated JSON", '{"name":'],
    ["raw NUL inside a string", '{"name":"a\u0000b"}'],
    ["text that is not JSON", "Zakupy na sobotę"],
    ["empty body", ""],
  ];

  for (const url of routes) {
    for (const [label, payload] of badBodies) {
      it(`POST ${url}: ${label} → 400 validation_failed (AC1)`, async () => {
        const response = await send({ method: "POST", url, headers: json, payload });

        expect({ status: response.statusCode, body: response.json<unknown>() }).toEqual({
          status: 400,
          body: VALIDATION_FAILED,
        });
        expect(response.body).not.toContain("Zakupy");
      });
    }

    it(`POST ${url}: unsupported content-type → 415 validation_failed`, async () => {
      const response = await send({
        method: "POST",
        url,
        headers: { "content-type": "application/xml" },
        payload: "<name>Zakupy</name>",
      });

      expect({ status: response.statusCode, body: response.json<unknown>() }).toEqual({
        status: 415,
        body: VALIDATION_FAILED,
      });
    });
  }

  it("a path parameter longer than maxParamLength → 414 validation_failed (AC2)", async () => {
    const response = await send({ method: "GET", url: `/api/v1/lists/${"a".repeat(101)}` });

    expect({ status: response.statusCode, body: response.json<unknown>() }).toEqual({
      status: 414,
      body: VALIDATION_FAILED,
    });
  });

  it("a malformed percent-encoding in the path → 400 validation_failed", async () => {
    const response = await send({ method: "GET", url: "/api/v1/lists/%E0%A4%A" });

    expect({ status: response.statusCode, body: response.json<unknown>() }).toEqual({
      status: 400,
      body: VALIDATION_FAILED,
    });
  });

  it("a body over the limit → 413 validation_failed, still logged as limit_reached (AC3)", async () => {
    const before = logs.security().length;
    const response = await send({
      method: "POST",
      url: "/api/v1/lists",
      headers: json,
      payload: JSON.stringify({ name: "x".repeat(HTTP_LIMITS.bodyBytes) }),
    });

    expect({ status: response.statusCode, body: response.json<unknown>() }).toEqual({
      status: 413,
      body: VALIDATION_FAILED,
    });
    expect(logs.security().slice(before)).toEqual([
      expect.objectContaining({ event: "limit_reached", limit: "bodyBytes" }),
    ]);
  });
});
