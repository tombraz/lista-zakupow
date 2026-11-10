import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { afterEach, describe, expect, it } from "vitest";
import { buildTestApp, TEST_ORIGIN } from "./app";
import { useTestDatabase } from "./database";
import { failingPool } from "./failing-pool";
import { randomIp, signIn, type TestUser } from "./factories";
import { gatedPool } from "./gated-pool";
import { requestsAs } from "./requests";
import { resetTokenFor } from "./reset-token";

const NEW_PASSWORD = "nowe haslo 123";
// Odczyt konta przy logowaniu (Better Auth `findUserByEmail` z kontami) — hash, który zweryfikuje.
const SIGN_IN_ACCOUNT_READ = /from "account" where "account"\."user_id" = \$1 limit/;
// Usunięcie sesji konta w resecie (Better Auth `deleteUserSessions`), przed zapisem hasła.
const RESET_SESSION_REVOKE = /^delete from "session" where "session"\."user_id" = \$1$/;
// Zapis nowego hasła w resecie (Better Auth `updatePassword`).
const PASSWORD_WRITE = /^update "account" set "password"/;

function resetPassword(app: FastifyInstance, token: string) {
  return app.inject({
    method: "POST",
    url: "/api/auth/reset-password",
    headers: { origin: TEST_ORIGIN },
    remoteAddress: randomIp(),
    payload: { token, newPassword: NEW_PASSWORD },
  });
}

async function signInWith(app: FastifyInstance, user: TestUser, password: string) {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/sign-in/email",
    headers: { origin: TEST_ORIGIN },
    remoteAddress: randomIp(),
    payload: { email: user.email, password },
  });
  return { status: response.statusCode, body: response.json<unknown>() };
}

async function sessionsOf(pool: Pool, user: TestUser): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    "SELECT count(*) AS count FROM session WHERE user_id = $1",
    [user.id],
  );
  return Number(rows[0]?.count);
}

// TH-10, MC-04, F-03: po udanym resecie nie działa żadna sesja z hasła sprzed resetu (T-118).
describe("a sign-in with the old password that overlaps a reset (T-118)", () => {
  const db = useTestDatabase();
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("leaves no working session when the old hash was read before the reset (AC1)", async () => {
    const gate = gatedPool(db.pool, SIGN_IN_ACCOUNT_READ);
    const test = await resetTokenFor(gate.pool);
    app = test.app;
    gate.hold();
    const signingIn = signInWith(app, test.user, test.user.password);
    await gate.held(1);

    const reset = await resetPassword(app, test.token);
    gate.release();
    const outcome = await signingIn;

    expect(reset.statusCode).toBe(200);
    expect(outcome).toEqual({
      status: 401,
      body: { error: { code: "invalid_credentials" } },
    });
    expect(await sessionsOf(db.pool, test.user)).toBe(0);
    expect((await signInWith(app, test.user, NEW_PASSWORD)).status).toBe(200);
  });

  it("leaves no working session when the sign-in ends between session revocation and the password write (AC1)", async () => {
    const gate = gatedPool(db.pool, RESET_SESSION_REVOKE, { clients: true });
    const test = await resetTokenFor(gate.pool);
    app = test.app;
    gate.hold();
    const resetting = resetPassword(app, test.token);
    await gate.held(1);

    const cookie = await signIn(app, test.user);
    gate.release();
    const reset = await resetting;

    expect(reset.statusCode).toBe(200);
    expect((await requestsAs(app, { cookie })("GET", "/api/v1/me")).statusCode).toBe(401);
    expect(await sessionsOf(db.pool, test.user)).toBe(0);
  });
});

// Kroki resetu (zużycie tokenu, usunięcie sesji, zapis hasła) razem albo wcale (T-118).
describe("a failed password write during a reset (T-118)", () => {
  const db = useTestDatabase();
  const apps: FastifyInstance[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it("keeps the token, the old password and the sessions (AC2)", async () => {
    const test = await resetTokenFor(failingPool(db.pool, PASSWORD_WRITE, { clients: true }));
    const healthy = buildTestApp(db.pool);
    apps.push(test.app, healthy);

    const failed = await resetPassword(test.app, test.token);

    expect(failed.statusCode).toBe(500);
    expect((await signInWith(healthy, test.user, test.user.password)).status).toBe(200);
    expect((await requestsAs(healthy, test.user)("GET", "/api/v1/me")).statusCode).toBe(200);
    expect((await resetPassword(healthy, test.token)).statusCode).toBe(200);
  });
});
