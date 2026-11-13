import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildTestApp, TEST_ORIGIN } from "./app";
import { useTestDatabase } from "./database";
import { createUser, randomIp } from "./factories";
import { captureLogs } from "./logs";
import { capturingMailer } from "./mailer";

const MINUTE_MS = 60 * 1000;
const ALERT_EMAIL = "alarm-wlasciciela@example.com";

function requestReset(app: FastifyInstance, email: string) {
  return app.inject({
    method: "POST",
    url: "/api/auth/request-password-reset",
    headers: { origin: TEST_ORIGIN },
    remoteAddress: randomIp(),
    payload: { email },
  });
}

/** `count` próśb dla adresu w paczkach po 3 co 15 minut (limit 15-minutowy, T-053). */
async function spreadRequests(app: FastifyInstance, emails: string[], count: number) {
  const statuses = new Map<string, number[]>(emails.map((email) => [email, []]));
  for (let done = 0; done < count; done += 3) {
    for (const email of emails) {
      for (let i = done; i < Math.min(done + 3, count); i += 1) {
        statuses.get(email)?.push((await requestReset(app, email)).statusCode);
      }
    }
    vi.setSystemTime(Date.now() + 15 * MINUTE_MS);
  }
  return statuses;
}

// T-120 (TH-10, N-03): prośby o reset nie wyczerpują dobowego limitu maili dostawcy.
describe("daily password reset mail limits (T-120)", () => {
  const db = useTestDatabase();

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-02T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stops sending reset mail to one address after the daily limit, with the same answer", async () => {
    const logs = captureLogs();
    const { mailer, sent } = capturingMailer();
    const app = buildTestApp(db.pool, { mailer, logger: { level: "info", stream: logs.stream } });
    const ania = await createUser(app);
    const unknown = `nikt-${randomUUID()}@example.com`;

    const statuses = await spreadRequests(app, [ania.email, unknown], 12);

    const expected = [...Array<number>(10).fill(200), 429, 429];
    expect(statuses.get(ania.email)).toEqual(expected);
    expect(statuses.get(unknown)).toEqual(expected);
    await vi.waitFor(() => {
      expect(sent).toHaveLength(10);
    });
    const daily = logs
      .security()
      .filter((entry) => entry["limit"] === "passwordResetPerEmailDaily");
    expect(daily).toEqual([
      expect.objectContaining({ event: "rate_limited" }),
      expect.objectContaining({ event: "rate_limited" }),
    ]);
    expect(new Set(daily.map((entry) => entry["accountKey"])).size).toBe(2);
    // Po dobie od pierwszej prośby adres znów dostaje mail.
    vi.setSystemTime(new Date("2026-11-03T10:00:00.000Z"));
    expect((await requestReset(app, ania.email)).statusCode).toBe(200);
    await vi.waitFor(() => {
      expect(sent).toHaveLength(11);
    });
    await app.close();
  });

  it("stops sending reset mail after the daily budget and alerts the owner once", async () => {
    const { mailer, sent } = capturingMailer();
    const app = buildTestApp(db.pool, { mailer, alertEmail: ALERT_EMAIL });
    const users = await Promise.all(Array.from({ length: 11 }, () => createUser(app)));
    const resets = () => sent.filter((mail) => mail.to !== ALERT_EMAIL);
    const alerts = () => sent.filter((mail) => mail.to === ALERT_EMAIL);

    await spreadRequests(
      app,
      users.slice(0, 10).map((user) => user.email),
      10,
    );
    await vi.waitFor(() => {
      expect(resets()).toHaveLength(100);
    });
    const over = [
      await requestReset(app, users[10]?.email ?? ""),
      await requestReset(app, users[10]?.email ?? ""),
    ];

    expect(over.map((response) => response.statusCode)).toEqual([200, 200]);
    // AC3: alarm wychodzi mimo wyczerpanego budżetu resetu (rezerwa).
    await vi.waitFor(() => {
      expect(alerts()).toHaveLength(1);
    });
    expect(resets()).toHaveLength(100);
    // Prewencja T-120: jeden alarm na okno budżetu, nie co 15 min (T-088) — inaczej alarmy same
    // wyczerpują dobę Brevo (mail-budget.test.ts).
    vi.setSystemTime(Date.now() + 60 * MINUTE_MS);
    expect((await requestReset(app, users[10]?.email ?? "")).statusCode).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(alerts()).toHaveLength(1);
    await app.close();
  });
});
