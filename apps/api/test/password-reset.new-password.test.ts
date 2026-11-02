import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildTestApp, TEST_ORIGIN } from "./app";
import { useTestDatabase } from "./database";
import { createUser, randomIp, signIn, type TestUser } from "./factories";
import { capturingMailer } from "./mailer";
import { requestsAs } from "./requests";
import { requestResetToken, resetTokenFor } from "./reset-token";

const RESET_PASSWORD = "/api/auth/reset-password";
const NEW_PASSWORD = "nowe haslo ąę 123";

function resetPassword(app: FastifyInstance, payload: object, origin: string | null = TEST_ORIGIN) {
  return app.inject({
    method: "POST",
    url: RESET_PASSWORD,
    headers: origin === null ? {} : { origin },
    remoteAddress: randomIp(),
    payload,
  });
}

function signInStatus(app: FastifyInstance, user: Pick<TestUser, "email">, password: string) {
  return app
    .inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      headers: { origin: TEST_ORIGIN },
      remoteAddress: randomIp(),
      payload: { email: user.email, password },
    })
    .then((response) => ({ status: response.statusCode, body: response.json<unknown>() }));
}

// F-03, api.md „Konta”: nowe hasło z linku resetu.
describe("new password from the reset link", () => {
  const db = useTestDatabase();
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    vi.useRealTimers();
    await app?.close();
    app = undefined;
  });

  it("sets the new password: the old one is refused, the new one signs in (AC1)", async () => {
    const test = await resetTokenFor(db.pool);
    app = test.app;

    const response = await resetPassword(app, { token: test.token, newPassword: NEW_PASSWORD });

    expect(response.statusCode).toBe(200);
    expect(await signInStatus(app, test.user, test.user.password)).toEqual({
      status: 401,
      body: { error: { code: "invalid_credentials" } },
    });
    expect((await signInStatus(app, test.user, NEW_PASSWORD)).status).toBe(200);
  });

  it("refuses a password shorter than 8 characters and keeps the token valid (AC2)", async () => {
    const test = await resetTokenFor(db.pool);
    app = test.app;

    const short = await resetPassword(app, { token: test.token, newPassword: "krótkie" });

    expect({ status: short.statusCode, body: short.json<unknown>() }).toEqual({
      status: 400,
      body: { error: { code: "validation_failed", fields: { newPassword: "too_short" } } },
    });
    expect((await signInStatus(app, test.user, test.user.password)).status).toBe(200);
    const valid = await resetPassword(app, { token: test.token, newPassword: NEW_PASSWORD });
    expect(valid.statusCode).toBe(200);
  });

  // AC4: link działa raz i przez 1 godzinę (F-03, TH-10).
  describe("a used or expired link (AC4)", () => {
    const INVALID_TOKEN = { status: 400, body: { error: { code: "invalid_token" } } };
    const outcome = (response: { statusCode: number; json: () => unknown }) => ({
      status: response.statusCode,
      body: response.json(),
    });

    it("refuses a token that was already used", async () => {
      const test = await resetTokenFor(db.pool);
      app = test.app;
      await resetPassword(app, { token: test.token, newPassword: NEW_PASSWORD });

      const again = await resetPassword(app, { token: test.token, newPassword: "inne haslo 456" });

      expect(outcome(again)).toEqual(INVALID_TOKEN);
      expect((await signInStatus(app, test.user, NEW_PASSWORD)).status).toBe(200);
    });

    it("refuses a token older than one hour", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-11-02T10:00:00.000Z"));
      const test = await resetTokenFor(db.pool);
      app = test.app;
      vi.setSystemTime(new Date("2026-11-02T11:00:01.000Z"));

      const late = await resetPassword(app, { token: test.token, newPassword: NEW_PASSWORD });

      expect(outcome(late)).toEqual(INVALID_TOKEN);
      expect((await signInStatus(app, test.user, test.user.password)).status).toBe(200);
    });

    it("refuses an unknown token", async () => {
      const test = await resetTokenFor(db.pool);
      app = test.app;

      const forged = await resetPassword(app, {
        token: `${test.token}x`,
        newPassword: NEW_PASSWORD,
      });

      expect(outcome(forged)).toEqual(INVALID_TOKEN);
    });

    it("refuses the token of an account deleted in the meantime", async () => {
      const test = await resetTokenFor(db.pool);
      app = test.app;
      await db.pool.query('DELETE FROM "user" WHERE id = $1', [test.user.id]);

      const orphan = await resetPassword(app, { token: test.token, newPassword: NEW_PASSWORD });

      expect(outcome(orphan)).toEqual(INVALID_TOKEN);
    });

    it("lets only one of two parallel resets with the same token succeed (SEC1)", async () => {
      const test = await resetTokenFor(db.pool);
      app = test.app;
      const testApp = test.app;
      const passwords = ["pierwsze haslo 1", "drugie haslo 22"];

      const responses = await Promise.all(
        passwords.map((newPassword) => resetPassword(testApp, { token: test.token, newPassword })),
      );

      const statuses = responses.map((response) => response.statusCode).sort();
      expect(statuses).toEqual([200, 400]);
      const failed = responses.find((response) => response.statusCode === 400);
      expect(failed && outcome(failed)).toEqual(INVALID_TOKEN);
      const winner = passwords[responses.findIndex((response) => response.statusCode === 200)];
      expect((await signInStatus(app, test.user, winner ?? "")).status).toBe(200);
    });
  });

  // T-075 (F-03, TH-10): po zmianie hasła żaden starszy link resetu konta nie działa.
  describe("other reset links of the account", () => {
    async function twoLinks() {
      const { mailer, sent } = capturingMailer();
      const testApp = buildTestApp(db.pool, { mailer });
      app = testApp;
      const user = await createUser(testApp);
      const first = await requestResetToken(testApp, user, sent);
      const second = await requestResetToken(testApp, user, sent);
      return { testApp, user, sent, first, second };
    }

    it("refuses the other unused link once the password was changed (AC1)", async () => {
      const { testApp, user, first, second } = await twoLinks();

      const used = await resetPassword(testApp, { token: second, newPassword: NEW_PASSWORD });
      const stale = await resetPassword(testApp, { token: first, newPassword: "inne haslo 456" });

      expect(used.statusCode).toBe(200);
      expect({ status: stale.statusCode, body: stale.json<unknown>() }).toEqual({
        status: 400,
        body: { error: { code: "invalid_token" } },
      });
      expect((await signInStatus(testApp, user, NEW_PASSWORD)).status).toBe(200);
    });

    it("keeps the reset links of another account valid (AC2)", async () => {
      const { testApp, sent, second } = await twoLinks();
      const other = await createUser(testApp);
      const otherToken = await requestResetToken(testApp, other, sent);

      await resetPassword(testApp, { token: second, newPassword: NEW_PASSWORD });
      const response = await resetPassword(testApp, {
        token: otherToken,
        newPassword: "haslo innego 789",
      });

      expect(response.statusCode).toBe(200);
      expect((await signInStatus(testApp, other, "haslo innego 789")).status).toBe(200);
    });

    it("lets only one of two parallel resets with different links succeed", async () => {
      const { testApp, user, first, second } = await twoLinks();
      const attempts = [
        { token: first, newPassword: "pierwsze haslo 1" },
        { token: second, newPassword: "drugie haslo 22" },
      ];

      const responses = await Promise.all(
        attempts.map((payload) => resetPassword(testApp, payload)),
      );

      expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 400]);
      const winner = attempts[responses.findIndex((response) => response.statusCode === 200)];
      expect((await signInStatus(testApp, user, winner?.newPassword ?? "")).status).toBe(200);
    });
  });

  // SEC1 (TH-10): reset kończy wszystkie sesje konta (np. przejęte urządzenie).
  it("deletes every session of the account", async () => {
    const test = await resetTokenFor(db.pool);
    app = test.app;
    const phone = await signIn(app, test.user);
    const other = await createUser(app);
    const testApp = test.app;
    const me = (cookie: string) => requestsAs(testApp, { cookie })("GET", "/api/v1/me");
    expect((await me(phone)).statusCode).toBe(200);

    await resetPassword(app, { token: test.token, newPassword: NEW_PASSWORD });

    expect((await me(test.user.cookie)).statusCode).toBe(401);
    expect((await me(phone)).statusCode).toBe(401);
    expect((await me(other.cookie)).statusCode).toBe(200);
  });

  // TH-14: zapis hasła tylko z originu aplikacji (trasa bez sesji, więc nie sprawdza go Better Auth).
  it("refuses a foreign or missing Origin with 403 and keeps the token valid", async () => {
    const test = await resetTokenFor(db.pool);
    app = test.app;

    for (const url of [RESET_PASSWORD, "/api/%61uth/reset-password"]) {
      for (const origin of ["https://evil.example", null]) {
        const response = await app.inject({
          method: "POST",
          url,
          headers: origin === null ? {} : { origin },
          remoteAddress: randomIp(),
          payload: { token: test.token, newPassword: NEW_PASSWORD },
        });
        expect({
          url,
          origin,
          status: response.statusCode,
          body: response.json<unknown>(),
        }).toEqual({ url, origin, status: 403, body: { error: { code: "invalid_origin" } } });
      }
    }
    expect((await signInStatus(app, test.user, test.user.password)).status).toBe(200);
  });

  it("answers hostile input with 400 validation_failed, never 500", async () => {
    app = buildTestApp(db.pool);

    for (const payload of [
      {},
      { token: "", newPassword: NEW_PASSWORD },
      { token: "a\u0000b", newPassword: NEW_PASSWORD },
      { token: ["x"], newPassword: NEW_PASSWORD },
      { token: "x", newPassword: 12345678 },
    ]) {
      const response = await resetPassword(app, payload);
      expect({
        payload,
        status: response.statusCode,
        code: response.json<{ error: { code: string } }>().error.code,
      }).toEqual({
        payload,
        status: 400,
        code: "validation_failed",
      });
    }
  });
});
