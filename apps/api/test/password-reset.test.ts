import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildTestApp, TEST_ORIGIN } from "./app";
import { useTestDatabase } from "./database";
import { createUser, randomIp } from "./factories";
import { capturingMailer } from "./mailer";

const REQUEST_RESET = "/api/auth/request-password-reset";
const NOW = "2026-11-02T10:00:00.000Z";
const HOUR_MS = 60 * 60 * 1000;

function requestReset(app: FastifyInstance, email: string, remoteAddress = randomIp()) {
  return app.inject({
    method: "POST",
    url: REQUEST_RESET,
    headers: { origin: TEST_ORIGIN },
    remoteAddress,
    payload: { email },
  });
}

/** Nagłówki bez tych, które z definicji różnią się między odpowiedziami. */
function stableHeaders(headers: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(headers).filter(([name]) => name !== "date" && name !== "x-request-id"),
  );
}

// F-03, api.md „Konta”: prośba o link resetu hasła.
describe("password reset request (AC1)", () => {
  const db = useTestDatabase();

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends one mail with a link to APP_ORIGIN and a token valid for one hour", async () => {
    const { mailer, sent } = capturingMailer();
    const app = buildTestApp(db.pool, { mailer });
    const ania = await createUser(app);

    const response = await app.inject({
      method: "POST",
      url: REQUEST_RESET,
      headers: { origin: TEST_ORIGIN },
      remoteAddress: randomIp(),
      payload: { email: ania.email },
    });

    expect(response.statusCode).toBe(200);
    await vi.waitFor(() => {
      expect(sent).toHaveLength(1);
    });
    const [mail] = sent;
    expect(mail?.to).toBe(ania.email);
    expect(mail?.subject).toBe("Reset hasła — Wspólna lista zakupów");
    const link = /http:\/\/localhost:5173\/reset-hasla\?token=([A-Za-z0-9_-]+)/.exec(
      mail?.text ?? "",
    );
    expect(link).not.toBeNull();
    const token = link?.[1] ?? "";
    expect(mail?.text).toBe(
      "Ktoś poprosił o reset hasła do Twojego konta. Kliknij link, żeby ustawić nowe hasło " +
        `(ważny 1 godzinę): ${TEST_ORIGIN}/reset-hasla?token=${token}. ` +
        "Jeśli to nie Ty, zignoruj tę wiadomość.",
    );
    const { rows } = await db.pool.query<{ value: string; expires_at: Date }>(
      "SELECT value, expires_at FROM verification WHERE identifier = $1",
      [`reset-password:${token}`],
    );
    expect(rows).toEqual([{ value: ania.id, expires_at: new Date(Date.parse(NOW) + HOUR_MS) }]);
    await app.close();
  });

  // TH-11: odpowiedź nie zdradza, czy konto istnieje — ani treścią, ani czasem.
  it("answers identically for an existing and an unknown e-mail, without waiting for the mail (SEC1)", async () => {
    // Dostarczenie wstrzymane do `release()`: odpowiedź przed nim dowodzi, że nie czeka na mail.
    const { mailer, requested, sent, release } = capturingMailer({ hold: true });
    const app = buildTestApp(db.pool, { mailer });
    const ania = await createUser(app);

    const existing = await requestReset(app, ania.email);
    const unknown = await requestReset(app, "nikt-taki@example.com");

    // Wysyłka zaczyna się przed odpowiedzią — na tym opierają się testy „mail nie wyszedł”.
    expect(requested.map((mail) => mail.to)).toEqual([ania.email]);
    expect(sent).toEqual([]);
    expect(unknown.statusCode).toBe(existing.statusCode);
    expect(unknown.body).toBe(existing.body);
    expect(stableHeaders(unknown.headers)).toEqual(stableHeaders(existing.headers));
    release();
    await vi.waitFor(() => {
      expect(sent.map((mail) => mail.to)).toEqual([ania.email]);
    });
    const { rows } = await db.pool.query<{ value: string }>(
      "SELECT value FROM verification WHERE identifier LIKE 'reset-password:%'",
    );
    expect(rows).toEqual([{ value: ania.id }]);
    await app.close();
  });

  // SEC5 (TH-14): prośba tylko z originu aplikacji; link w mailu zawsze na APP_ORIGIN.
  it("refuses a foreign or missing Origin with 403 before writing anything", async () => {
    const { mailer, requested } = capturingMailer();
    const app = buildTestApp(db.pool, { mailer });
    const ania = await createUser(app);
    const before = await db.pool.query("SELECT key FROM rate_limit ORDER BY key");

    for (const url of [REQUEST_RESET, "/api/%61uth/request-password-reset"]) {
      for (const origin of ["https://evil.example", undefined]) {
        const response = await app.inject({
          method: "POST",
          url,
          headers: origin ? { origin } : {},
          remoteAddress: randomIp(),
          payload: { email: ania.email },
        });

        expect({ url, origin, status: response.statusCode }).toEqual({ url, origin, status: 403 });
        expect(response.json()).toEqual({ error: { code: "invalid_origin" } });
      }
    }
    expect((await db.pool.query("SELECT key FROM rate_limit ORDER BY key")).rows).toEqual(
      before.rows,
    );
    expect((await db.pool.query("SELECT 1 FROM verification")).rows).toEqual([]);
    // Wysyłka zaczyna się przed odpowiedzią (SEC1): po odpowiedzi bez niej mail już nie wyjdzie.
    expect(requested).toEqual([]);
    await app.close();
  });

  it("ignores a foreign redirectTo and a forged Host: the link always points to APP_ORIGIN", async () => {
    const { mailer, sent } = capturingMailer();
    const app = buildTestApp(db.pool, { mailer });
    const ania = await createUser(app);

    const response = await app.inject({
      method: "POST",
      url: REQUEST_RESET,
      headers: { origin: TEST_ORIGIN, host: "evil.example", "x-forwarded-host": "evil.example" },
      remoteAddress: randomIp(),
      payload: { email: ania.email, redirectTo: "https://evil.example/przejmij" },
    });

    expect(response.statusCode).toBe(200);
    await vi.waitFor(() => {
      expect(sent).toHaveLength(1);
    });
    expect(sent[0]?.text).toContain(`${TEST_ORIGIN}/reset-hasla?token=`);
    expect(sent[0]?.text).not.toContain("evil");
    await app.close();
  });
});
