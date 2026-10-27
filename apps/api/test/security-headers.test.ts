import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { useTestDatabase } from "./database";

const webDistDir = fileURLToPath(new URL("./fixtures/web-dist", import.meta.url));

describe("security headers (SEC1: TH-08, TH-15, TH-24)", () => {
  const db = useTestDatabase();
  let app: FastifyInstance;

  beforeAll(() => {
    app = buildApp({ pool: db.pool, webDistDir });
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(["/health", "/", "/listy/123"])(
    "%s carries CSP, HSTS and the other headers",
    async (url) => {
      const response = await app.inject({ method: "GET", url });

      expect(response.statusCode).toBe(200);
      const csp = String(response.headers["content-security-policy"]);
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).not.toContain("unsafe-inline");
      expect(response.headers["strict-transport-security"]).toContain("max-age=");
      expect(response.headers["referrer-policy"]).toBe("no-referrer");
      expect(response.headers["x-content-type-options"]).toBe("nosniff");
      // Starsze przeglądarki ignorują frame-ancestors; X-Frame-Options musi mówić to samo.
      expect(response.headers["x-frame-options"]).toBe("DENY");
    },
  );

  it("serves index.html for paths outside /api and /health", async () => {
    const response = await app.inject({ method: "GET", url: "/listy/123" });

    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.body).toContain("fixture index");
  });

  it("does not answer unknown /api paths with the SPA", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/nope" });

    expect(response.statusCode).toBe(404);
    expect(response.body).not.toContain("fixture index");
  });

  it("does not allow cross-origin requests (no CORS)", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health",
      headers: { origin: "https://evil.example" },
    });
    const preflight = await app.inject({
      method: "OPTIONS",
      url: "/health",
      headers: { origin: "https://evil.example", "access-control-request-method": "GET" },
    });

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    expect(preflight.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
