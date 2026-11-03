import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppOptions } from "../src/app";
import {
  MailDeliveryError,
  MailTimeoutError,
  type Mail,
  type Mailer,
} from "../src/modules/konta/domain/mailer";
import { buildTestApp, TEST_ORIGIN } from "./app";
import { testClock } from "./clock";
import { useTestDatabase } from "./database";
import { failingPool } from "./failing-pool";
import { createUser, randomIp } from "./factories";
import { connectLive, liveUrl } from "./live";
import { captureLogs } from "./logs";
import { capturingMailer } from "./mailer";
import { requestResetToken } from "./reset-token";

// Zapytanie `ResetTokens.revokeAll` (T-075): usunięcie wszystkich tokenów resetu konta.
const REVOKE_ALL = /delete from "verification" where .*like/i;
const ALERT_EMAIL = "alarm-wlasciciela@example.com";
const ALERT_SUBJECT = "Alarm: linki resetu hasła nie zostały unieważnione";

function resetPassword(app: FastifyInstance, token: string, newPassword: string) {
  return app.inject({
    method: "POST",
    url: "/api/auth/reset-password",
    headers: { origin: TEST_ORIGIN },
    remoteAddress: randomIp(),
    payload: { token, newPassword },
  });
}

// T-088 (N-03): błąd unieważnienia pozostałych linków resetu (T-087) to mail do właściciela.
describe("owner alert after a failed revocation of the other reset links (T-088)", () => {
  const db = useTestDatabase();
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  function alertApp(options: Partial<AppOptions> = {}) {
    const capture = capturingMailer();
    const clock = testClock("2026-11-02T10:00:00.000Z");
    app = buildTestApp(failingPool(db.pool, REVOKE_ALL), {
      mailer: capture.mailer,
      alertEmail: ALERT_EMAIL,
      clock,
      ...options,
    });
    const alerts = () => capture.sent.filter((mail) => mail.to === ALERT_EMAIL);
    return { app, sent: capture.sent, alerts, clock };
  }

  it("mails the owner once with userId, event time and the links' latest expiry (AC1)", async () => {
    const { app, sent, alerts } = alertApp();
    const user = await createUser(app);
    const token = await requestResetToken(app, user, sent);

    const response = await resetPassword(app, token, "nowe haslo 123");

    expect(response.statusCode).toBe(200);
    await vi.waitFor(() => {
      expect(alerts()).toHaveLength(1);
    });
    const [alert] = alerts();
    expect(alert?.subject).toBe(ALERT_SUBJECT);
    expect(alert?.text).toContain(user.id);
    expect(alert?.text).toContain("2026-11-02T10:00:00.000Z");
    expect(alert?.text).toContain("2026-11-02T11:00:00.000Z");
  });

  it("sends no alert after a reset without a revocation failure (AC6)", async () => {
    const { app, sent, alerts } = alertApp({ pool: db.pool });
    const user = await createUser(app);
    const token = await requestResetToken(app, user, sent);

    expect((await resetPassword(app, token, "nowe haslo 123")).statusCode).toBe(200);

    expect(alerts()).toEqual([]);
  });

  // TH-10: z zewnątrz nie da się wywołać alarmu — tylko błąd serwera po udanym resecie.
  it("sends no alert for a wrong, a missing or a used token (SEC2)", async () => {
    const { app, sent, alerts, clock } = alertApp();
    const user = await createUser(app);
    const token = await requestResetToken(app, user, sent);
    expect((await resetPassword(app, token, "nowe haslo 123")).statusCode).toBe(200);
    await vi.waitFor(() => {
      expect(alerts()).toHaveLength(1);
    });
    // Poza oknem tłumienia: alarm z próby z zewnątrz nie zginąłby w oknie.
    clock.set("2026-11-02T11:00:00.000Z");

    const attempts = [
      await resetPassword(app, token, "jeszcze inne 123"),
      await resetPassword(app, "zly-token-0123456789", "jeszcze inne 123"),
      await app.inject({
        method: "POST",
        url: "/api/auth/reset-password",
        headers: { origin: TEST_ORIGIN },
        remoteAddress: randomIp(),
        payload: { newPassword: "jeszcze inne 123" },
      }),
    ];

    expect(attempts.map((response) => response.statusCode)).toEqual([400, 400, 400]);
    expect(alerts()).toHaveLength(1);
  });

  // TH-21: w mailu tylko userId i kod błędu; w logu nigdy adres alarmu.
  it("keeps the account e-mail, tokens, the alert address and the database message out (SEC1)", async () => {
    const logs = captureLogs();
    const { app, sent, alerts } = alertApp({ logger: { level: "info", stream: logs.stream } });
    const user = await createUser(app);
    const first = await requestResetToken(app, user, sent);
    const second = await requestResetToken(app, user, sent);

    expect((await resetPassword(app, second, "nowe haslo 123")).statusCode).toBe(200);
    await vi.waitFor(() => {
      expect(alerts()).toHaveLength(1);
    });

    const mail = `${alerts()[0]?.subject ?? ""}\n${alerts()[0]?.text ?? ""}`;
    expect(mail).toContain("57P01");
    for (const secret of [user.email, first, second, ALERT_EMAIL, "connection terminated"]) {
      expect(mail).not.toContain(secret);
    }
    const log = logs.lines.join("\n");
    for (const secret of [user.email, first, second, ALERT_EMAIL]) {
      expect(log).not.toContain(secret);
    }
  });

  // N-03: seria błędów (np. awaria bazy) nie wyczerpuje dziennego limitu Brevo (300/dzień).
  it("sends at most one alert per 15 minutes, then reports how many were skipped (AC2)", async () => {
    const { app, sent, alerts, clock } = alertApp();
    const [first, second] = [await createUser(app), await createUser(app)];
    const reset = async (user: typeof first) => {
      const token = await requestResetToken(app, user, sent);
      expect((await resetPassword(app, token, "nowe haslo 123")).statusCode).toBe(200);
    };

    await reset(first);
    await vi.waitFor(() => {
      expect(alerts()).toHaveLength(1);
    });
    clock.set("2026-11-02T10:14:59.999Z");
    await reset(second);
    await reset(first);
    expect(alerts()).toHaveLength(1);

    clock.set("2026-11-02T10:15:00.000Z");
    await reset(second);

    await vi.waitFor(() => {
      expect(alerts()).toHaveLength(2);
    });
    expect(alerts()[0]?.text).toContain("Pominięte takie same zdarzenia od poprzedniego alarmu: 0");
    expect(alerts()[1]?.text).toContain("Pominięte takie same zdarzenia od poprzedniego alarmu: 2");
    expect(alerts()[1]?.text).toContain("2026-11-02T10:15:00.000Z");
  });

  it.each([
    ["a provider refusal", new MailDeliveryError(502), { error: "MailDeliveryError", status: 502 }],
    ["a provider timeout", new MailTimeoutError(10_000), { error: "MailTimeoutError" }],
  ])(
    "answers 200, logs password_reset and closes live connections despite %s (AC3)",
    async (_case, failure, logged) => {
      const logs = captureLogs();
      const capture = capturingMailer();
      const mailer: Mailer = {
        send: (mail) =>
          mail.to === ALERT_EMAIL ? Promise.reject(failure) : capture.mailer.send(mail),
      };
      const { app } = alertApp({ mailer, logger: { level: "info", stream: logs.stream } });
      const user = await createUser(app);
      const token = await requestResetToken(app, user, capture.sent);
      const socket = await connectLive(await liveUrl(app), { cookie: user.cookie });

      const response = await resetPassword(app, token, "nowe haslo 123");

      expect(response.statusCode).toBe(200);
      expect(logs.security()).toContainEqual(
        expect.objectContaining({ event: "password_reset", userId: user.id }),
      );
      expect(await socket.closed()).toBe(1008);
      await vi.waitFor(() => {
        expect(logs.entries()).toContainEqual(
          expect.objectContaining({
            level: 50,
            event: "owner_alert_failed",
            alert: "reset_tokens_revoke_failed",
            ...logged,
          }),
        );
      });
      expect(logs.lines.join("\n")).not.toContain(ALERT_EMAIL);
    },
  );

  it("answers the reset without waiting for the alert mail (AC4)", async () => {
    const capture = capturingMailer();
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const alertsSent: Mail[] = [];
    const mailer: Mailer = {
      send: async (mail) => {
        if (mail.to !== ALERT_EMAIL) return capture.mailer.send(mail);
        await held;
        alertsSent.push(mail);
      },
    };
    const { app } = alertApp({ mailer });
    const user = await createUser(app);
    const token = await requestResetToken(app, user, capture.sent);

    const response = await resetPassword(app, token, "nowe haslo 123");

    expect(response.statusCode).toBe(200);
    expect(alertsSent).toEqual([]);
    release();
    await vi.waitFor(() => {
      expect(alertsSent).toHaveLength(1);
    });
  });
});
