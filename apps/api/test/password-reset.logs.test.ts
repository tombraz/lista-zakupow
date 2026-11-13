import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { describe, expect, it, vi } from "vitest";
import type { Mail } from "../src/modules/konta";
import { buildTestApp, TEST_ORIGIN } from "./app";
import { useTestDatabase } from "./database";
import { createUser, randomIp } from "./factories";
import { captureLogs } from "./logs";
import { resetTokenFor } from "./reset-token";

function requestReset(app: FastifyInstance, email: string) {
  return app.inject({
    method: "POST",
    url: "/api/auth/request-password-reset",
    headers: { origin: TEST_ORIGIN },
    remoteAddress: randomIp(),
    payload: { email },
  });
}

// SEC4 (TH-21): e-mail, token i treść maila resetu nie trafiają do logu; limit — do `security`.
describe("password reset in logs (SEC4)", () => {
  const db = useTestDatabase();

  it("keeps the e-mail, the token and the mail out of logs, also when the provider fails", async () => {
    const logs = captureLogs();
    const sent: Mail[] = [];
    // Dostawca odrzuca wysyłkę błędem z adresem odbiorcy (np. „invalid recipient …”).
    const failing = {
      send: (mail: Mail) => {
        sent.push(mail);
        return Promise.reject(new Error(`invalid recipient ${mail.to}: ${mail.text}`));
      },
    };
    const app = buildTestApp(db.pool, {
      logger: { level: "info", stream: logs.stream },
      mailer: failing,
    });
    const local = `reset${randomUUID().slice(0, 8)}`;
    const ania = await createUser(app, { email: `${local}@example.com` });
    const unknown = `nikt${randomUUID().slice(0, 8)}`;

    expect((await requestReset(app, ania.email)).statusCode).toBe(200);
    expect((await requestReset(app, `${unknown}@example.com`)).statusCode).toBe(200);
    await vi.waitFor(() => {
      expect(logs.entries().some((entry) => entry["event"] === "password_reset_mail_failed")).toBe(
        true,
      );
    });
    const token = /token=([\w-]+)/.exec(sent[0]?.text ?? "")?.[1];

    expect(token).toEqual(expect.any(String));
    const text = logs.lines.join("\n");
    for (const secret of [local, unknown, token ?? "", "Kliknij link", "Reset hasła"]) {
      expect(text).not.toContain(secret);
    }
    await app.close();
  });

  // T-098, QA edge case: dostawca odrzuca czymś, co nie jest `Error` (tekst z adresem).
  it("logs a non-Error provider failure as its type only", async () => {
    const logs = captureLogs();
    const app = buildTestApp(db.pool, {
      logger: { level: "info", stream: logs.stream },
      mailer: {
        // Biblioteka dostawcy odrzuca tekstem (thenable spoza naszego kodu), nie `Error`.
        send: (mail: Mail) =>
          Promise.resolve({
            then: (_resolve: unknown, reject: (reason: unknown) => void) => {
              reject(`invalid recipient ${mail.to}`);
            },
          }).then(() => undefined),
      },
    });
    const local = `reset${randomUUID().slice(0, 8)}`;
    await createUser(app, { email: `${local}@example.com` });

    expect((await requestReset(app, `${local}@example.com`)).statusCode).toBe(200);
    await vi.waitFor(() => {
      expect(
        logs.entries().filter((entry) => entry["event"] === "password_reset_mail_failed"),
      ).toEqual([expect.objectContaining({ level: 50, err: { type: "string" } })]);
    });
    expect(logs.lines.join("\n")).not.toContain(local);
    await app.close();
  });

  it("logs exceeding the per-e-mail limit once, with the account pseudonym and no e-mail", async () => {
    const logs = captureLogs();
    const app = buildTestApp(db.pool, { logger: { level: "info", stream: logs.stream } });
    const local = `reset${randomUUID().slice(0, 8)}`;

    for (let attempt = 0; attempt < 6; attempt += 1) {
      await requestReset(app, `${local}@example.com`);
    }

    expect(logs.security()).toEqual([
      expect.objectContaining({
        event: "rate_limited",
        limit: "passwordResetPerEmail",
        route: "/api/auth/request-password-reset",
        accountKey: expect.any(String) as unknown,
      }),
    ]);
    expect(logs.lines.join("\n")).not.toContain(local);
    await app.close();
  });
});

// SEC3 (TH-21): token i nowe hasło nie trafiają do logu; udany reset — do `security`.
describe("new password in logs (SEC3)", () => {
  const db = useTestDatabase();

  it("keeps the token and the password out of logs and records password_reset with userId", async () => {
    const logs = captureLogs();
    const { app, user, token } = await resetTokenFor(db.pool, {
      logger: { level: "info", stream: logs.stream },
    });
    const newPassword = `nowe-${randomUUID()}`;
    const before = logs.security().length;

    // Strona kroku 2 z tokenem w adresie (serwuje ją API, ADR 0006), potem zapis hasła.
    await app.inject({ method: "GET", url: `/reset-hasla?token=${token}` });
    const response = await app.inject({
      method: "POST",
      url: `/api/auth/reset-password?token=${token}`,
      headers: { origin: TEST_ORIGIN },
      remoteAddress: randomIp(),
      payload: { token, newPassword },
    });

    expect(response.statusCode).toBe(200);
    const text = logs.lines.join("\n");
    for (const secret of [token, newPassword, user.email]) {
      expect(text).not.toContain(secret);
    }
    expect(logs.security().slice(before)).toEqual([
      expect.objectContaining({
        event: "password_reset",
        userId: user.id,
        route: "/api/auth/reset-password",
      }),
    ]);
    expect(JSON.stringify(logs.security())).not.toContain("@example.com");
    await app.close();
  });
});
