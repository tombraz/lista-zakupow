import { TERMS_VERSION } from "@lista/shared";
import { afterEach, describe, expect, it } from "vitest";
import { buildTestApp, TEST_ORIGIN } from "./app";
import { cookieHeader, sessionCookie } from "./cookies";
import { useTestDatabase } from "./database";
import { createUser } from "./factories";

const newAccount = {
  name: "Ania",
  email: "ania@example.com",
  password: "dobre-haslo-1",
  termsAccepted: true,
  ageConfirmed: true,
};

describe("POST /api/auth/sign-up/email (AC1)", () => {
  const db = useTestDatabase();
  let app: ReturnType<typeof buildTestApp> | undefined;

  afterEach(async () => {
    await app?.close();
  });

  function signUp(payload: object, origin = TEST_ORIGIN) {
    if (!app) throw new Error("build the app first");
    return app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      headers: { origin },
      payload,
    });
  }

  it("creates the account with consents and starts an HttpOnly, SameSite=Lax session", async () => {
    app = buildTestApp(db.pool);

    const response = await signUp(newAccount);

    expect(response.statusCode).toBe(200);
    const body = response.json<{ user: { id: string; name: string; email: string } }>();
    expect(Object.keys(body)).toEqual(["user"]);
    expect(body.user.id).toEqual(expect.any(String));
    expect(body.user).toEqual({ id: body.user.id, name: "Ania", email: "ania@example.com" });
    const cookie = sessionCookie(response.headers["set-cookie"]);
    expect(cookie).toMatch(/;\s*HttpOnly/i);
    expect(cookie).toMatch(/;\s*SameSite=Lax/i);
    expect(cookie).not.toMatch(/;\s*Secure/i);

    const { rows } = await db.pool.query<{
      terms_accepted_at: Date | null;
      terms_version: string | null;
      age_confirmed_at: Date | null;
    }>(`SELECT terms_accepted_at, terms_version, age_confirmed_at FROM "user" WHERE id = $1`, [
      body.user.id,
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.terms_accepted_at).toBeInstanceOf(Date);
    expect(rows[0]?.age_confirmed_at).toBeInstanceOf(Date);
    expect(rows[0]?.terms_version).toBe(TERMS_VERSION);
  });

  it("lets GET /api/v1/me read the new session", async () => {
    app = buildTestApp(db.pool);
    const signedUp = await signUp(newAccount);
    const cookie = cookieHeader(signedUp.headers["set-cookie"]);

    const me = await app.inject({ method: "GET", url: "/api/v1/me", headers: { cookie } });

    expect(me.statusCode).toBe(200);
    expect(me.json()).toEqual({
      id: signedUp.json<{ user: { id: string } }>().user.id,
      name: "Ania",
      email: "ania@example.com",
    });
  });

  it("never exposes the session token to JavaScript in the response body (TH-16)", async () => {
    app = buildTestApp(db.pool);

    const response = await signUp(newAccount);

    const [, signedToken = ""] = cookieHeader(response.headers["set-cookie"]).split("=");
    const [token = ""] = decodeURIComponent(signedToken).split(".");
    expect(token.length).toBeGreaterThan(0);
    expect(response.body).not.toContain(token);
  });

  it("marks the session cookie Secure when the app is served over HTTPS", async () => {
    const origin = "https://lista.example";
    app = buildTestApp(db.pool, { auth: { secret: "x".repeat(48), origin } });

    const response = await signUp(newAccount, origin);

    expect(response.statusCode).toBe(200);
    expect(sessionCookie(response.headers["set-cookie"])).toMatch(/;\s*Secure/i);
  });
});

describe("POST /api/auth/sign-up/email with a used e-mail (AC2)", () => {
  const db = useTestDatabase();

  it("answers 409 email_taken for the same address in different letter case", async () => {
    const app = buildTestApp(db.pool);
    await createUser(app, { email: "a@x.pl" });

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      headers: { origin: TEST_ORIGIN },
      payload: { ...newAccount, email: "A@x.pl" },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: { code: "email_taken" } });
    const { rows } = await db.pool.query(`SELECT 1 FROM "user"`);
    expect(rows).toHaveLength(1);
    await app.close();
  });

  // QA round 1, #3: podwójne kliknięcie „Załóż konto” — wyścig na unikalnym e-mailu.
  it("answers 409 email_taken to the second of two simultaneous sign-ups", async () => {
    const app = buildTestApp(db.pool);
    const signUp = () =>
      app.inject({
        method: "POST",
        url: "/api/auth/sign-up/email",
        headers: { origin: TEST_ORIGIN },
        payload: newAccount,
      });

    const responses = await Promise.all([signUp(), signUp()]);

    const statuses = responses.map((response) => response.statusCode).sort();
    expect(statuses).toEqual([200, 409]);
    const rejected = responses.find((response) => response.statusCode !== 200);
    expect(rejected?.json()).toEqual({ error: { code: "email_taken" } });
    const { rows } = await db.pool.query(`SELECT 1 FROM "user"`);
    expect(rows).toHaveLength(1);
    await app.close();
  });
});

describe("POST /api/auth/sign-up/email when the database rejects the account", () => {
  const db = useTestDatabase();

  afterEach(async () => {
    await db.pool.query(`DROP TRIGGER IF EXISTS reject_user ON "user"`);
  });

  // QA round 1, #3: błąd, którego API nie zna, to 500 `internal` (api.md), nie status Better Auth.
  it("answers 500 internal", async () => {
    await db.pool.query(`
      CREATE OR REPLACE FUNCTION reject_user() RETURNS trigger LANGUAGE plpgsql
        AS $$ BEGIN RAISE EXCEPTION 'rejected by test'; END $$;
      CREATE TRIGGER reject_user BEFORE INSERT ON "user" FOR EACH ROW EXECUTE FUNCTION reject_user();
    `);
    const app = buildTestApp(db.pool);

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      headers: { origin: TEST_ORIGIN },
      payload: newAccount,
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: { code: "internal" } });
    await app.close();
  });
});

describe("POST /api/auth/sign-up/email with invalid data (AC3)", () => {
  const db = useTestDatabase();

  const cases: [string, object, Record<string, string>][] = [
    ["terms not accepted", { termsAccepted: false }, { termsAccepted: "required" }],
    ["age not confirmed", { ageConfirmed: undefined }, { ageConfirmed: "required" }],
    ["password of 7 characters", { password: "1234567" }, { password: "too_short" }],
    ["empty name", { name: "" }, { name: "required" }],
    ["name of 31 characters", { name: "a".repeat(31) }, { name: "too_long" }],
    ["name with NUL (T-026)", { name: "a\u0000b" }, { name: "invalid" }],
  ];

  for (const [label, change, fields] of cases) {
    it(`answers 400 validation_failed and creates no account: ${label}`, async () => {
      const app = buildTestApp(db.pool);

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/sign-up/email",
        headers: { origin: TEST_ORIGIN },
        payload: { ...newAccount, ...change },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ error: { code: "validation_failed", fields } });
      const { rows } = await db.pool.query(`SELECT 1 FROM "user"`);
      expect(rows).toEqual([]);
      await app.close();
    });
  }
});
