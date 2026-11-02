import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildTestApp, TEST_ORIGIN } from "./app";
import { useTestDatabase } from "./database";
import { failingPool } from "./failing-pool";
import { createUser, randomIp } from "./factories";
import { connectLive, liveUrl } from "./live";
import { captureLogs } from "./logs";
import { capturingMailer } from "./mailer";
import { requestResetToken } from "./reset-token";

// Zapytanie `ResetTokens.revokeAll` (T-075): usunięcie wszystkich tokenów resetu konta.
const REVOKE_ALL = /delete from "verification" where .*like/i;

function resetPassword(app: FastifyInstance, token: string, newPassword: string) {
  return app.inject({
    method: "POST",
    url: "/api/auth/reset-password",
    headers: { origin: TEST_ORIGIN },
    remoteAddress: randomIp(),
    payload: { token, newPassword },
  });
}

// T-087: hasło już zmienione w Better Auth, a unieważnienie pozostałych linków konta się nie udało.
describe("a failed revocation of the other reset links (T-087)", () => {
  const db = useTestDatabase();
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("still logs password_reset, closes live connections and answers 200 (AC1, AC2)", async () => {
    const logs = captureLogs();
    const { mailer, sent } = capturingMailer();
    app = buildTestApp(failingPool(db.pool, REVOKE_ALL), {
      mailer,
      logger: { level: "info", stream: logs.stream },
    });
    const user = await createUser(app);
    const first = await requestResetToken(app, user, sent);
    const second = await requestResetToken(app, user, sent);
    const socket = await connectLive(await liveUrl(app), { cookie: user.cookie });

    const response = await resetPassword(app, second, "nowe haslo 123");

    expect({ status: response.statusCode, body: response.json<unknown>() }).toEqual({
      status: 200,
      body: {},
    });
    expect(logs.security()).toContainEqual(
      expect.objectContaining({ event: "password_reset", userId: user.id }),
    );
    expect(await socket.closed()).toBe(1008);
    const failure = logs.entries().find((entry) => entry["event"] === "reset_tokens_revoke_failed");
    expect(failure).toEqual(
      expect.objectContaining({
        level: 50,
        userId: user.id,
        err: expect.objectContaining({
          type: "DrizzleQueryError",
          cause: expect.objectContaining({ code: "57P01" }) as unknown,
        }) as unknown,
      }),
    );
    const text = logs.lines.join("\n");
    for (const secret of [first, second, user.email]) expect(text).not.toContain(secret);
    // Kolejka resetów konta (`ResetTokens.exclusive`) się nie zablokowała.
    expect((await resetPassword(app, first, "jeszcze nowsze 123")).statusCode).toBe(200);
  });
});
