import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { RATE_LIMITS } from "@lista/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildTestApp, TEST_ORIGIN } from "./app";
import { useTestDatabase } from "./database";
import { createUser, randomIp } from "./factories";
import { capturingMailer } from "./mailer";

const MINUTE_MS = 60 * 1000;

function requestReset(app: FastifyInstance, email: string, remoteAddress: string) {
  return app.inject({
    method: "POST",
    url: "/api/auth/request-password-reset",
    headers: { origin: TEST_ORIGIN },
    remoteAddress,
    payload: { email },
  });
}

function unknownEmail() {
  return `nikt-${randomUUID()}@example.com`;
}

// F-03, MC-04 (TH-10), MC-05 (TH-27): prośby o reset ograniczane per IP i per e-mail.
describe("password reset request limits (SEC2, SEC3)", () => {
  const db = useTestDatabase();

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-02T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Wiersze tabel pisanych przed uwierzytelnieniem (tokeny, liczniki limitów). */
  async function preAuthRows() {
    const { rows } = await db.pool.query<{ verification: number; rate_limit: number }>(
      `SELECT (SELECT count(*)::int FROM verification) AS verification,
              (SELECT count(*)::int FROM rate_limit) AS rate_limit`,
    );
    return rows[0];
  }

  it("pins the thresholds: 3 per e-mail in 15 minutes, 3 per IP in a minute", () => {
    // Próg per e-mail zatwierdzony przez właściciela 2026-11-01 (T-053, SEC2); per IP — próg
    // Better Auth dla resetu (threat-model.md: limit resetu przez `rateLimit` Better Auth).
    expect(RATE_LIMITS.passwordResetPerEmail).toEqual({ windowSeconds: 15 * 60, max: 3 });
    expect(RATE_LIMITS.passwordResetPerIp).toEqual({ windowSeconds: 60, max: 3 });
  });

  it("answers 429 to the 4th request from one IP and sends no mail", async () => {
    const { mailer, sent } = capturingMailer();
    const app = buildTestApp(db.pool, { mailer });
    const ania = await createUser(app);
    const ip = randomIp();

    const statuses: number[] = [];
    for (let attempt = 0; attempt < 3; attempt += 1) {
      statuses.push((await requestReset(app, unknownEmail(), ip)).statusCode);
    }
    const before = await preAuthRows();
    const fourth = await requestReset(app, ania.email, ip);
    const more = await Promise.all(
      Array.from({ length: 5 }, () => requestReset(app, unknownEmail(), ip)),
    );

    expect(statuses).toEqual([200, 200, 200]);
    expect(fourth.statusCode).toBe(429);
    expect(fourth.json()).toEqual({ error: { code: "rate_limited" } });
    expect(more.map((response) => response.statusCode)).toEqual([429, 429, 429, 429, 429]);
    // SEC3 (TH-27): po limicie IP nowe e-maile nie dokładają wierszy.
    expect(await preAuthRows()).toEqual(before);
    expect((await requestReset(app, ania.email, randomIp())).statusCode).toBe(200);
    await vi.waitFor(() => {
      expect(sent).toHaveLength(1);
    });
    await app.close();
  });

  it("answers 429 to the 4th request for one e-mail from different IPs and sends no 4th mail", async () => {
    const { mailer, requested, sent } = capturingMailer();
    const app = buildTestApp(db.pool, { mailer });
    const ania = await createUser(app);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect((await requestReset(app, ania.email, randomIp())).statusCode).toBe(200);
    }
    await vi.waitFor(() => {
      expect(sent).toHaveLength(3);
    });
    const before = await preAuthRows();
    const fourth = await requestReset(app, ` ${ania.email.toUpperCase()} `, randomIp());
    const more = await Promise.all(
      Array.from({ length: 5 }, () => requestReset(app, ania.email, randomIp())),
    );

    expect(fourth.statusCode).toBe(429);
    expect(fourth.json()).toEqual({ error: { code: "rate_limited" } });
    expect(more.map((response) => response.statusCode)).toEqual([429, 429, 429, 429, 429]);
    // SEC3 (TH-27): prośby ponad limit e-maila nie piszą tokenów ani liczników.
    expect(await preAuthRows()).toEqual(before);
    // Wysyłka zaczyna się przed odpowiedzią (password-reset.test.ts, SEC1): nie ma czwartej.
    expect(requested).toHaveLength(3);
    await app.close();
  });

  it("limits an unknown e-mail the same way, so the limit does not reveal the account (TH-11)", async () => {
    const app = buildTestApp(db.pool);
    const email = unknownEmail();

    const statuses: number[] = [];
    for (let attempt = 0; attempt < 4; attempt += 1) {
      statuses.push((await requestReset(app, email, randomIp())).statusCode);
    }

    expect(statuses).toEqual([200, 200, 200, 429]);
    await app.close();
  });

  it("counts at most 3 requests per e-mail when they arrive in parallel", async () => {
    const { mailer, sent } = capturingMailer();
    const app = buildTestApp(db.pool, { mailer });
    const ania = await createUser(app);

    const responses = await Promise.all(
      Array.from({ length: 10 }, () => requestReset(app, ania.email, randomIp())),
    );

    const statuses = responses.map((response) => response.statusCode);
    expect(statuses.filter((status) => status === 200)).toHaveLength(3);
    expect(statuses.filter((status) => status === 429)).toHaveLength(7);
    await vi.waitFor(() => {
      expect(sent).toHaveLength(3);
    });
    await app.close();
  });

  it("allows requests for the e-mail again after 15 minutes", async () => {
    const app = buildTestApp(db.pool);
    const email = unknownEmail();
    for (let attempt = 0; attempt < 3; attempt += 1) await requestReset(app, email, randomIp());

    vi.setSystemTime(Date.now() + 15 * MINUTE_MS);
    const later = await requestReset(app, email, randomIp());

    expect(later.statusCode).toBe(200);
    await app.close();
  });
});
