import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BrevoMailer } from "../src/modules/konta/infra/brevo-mailer";
import { buildTestApp, TEST_ORIGIN } from "./app";
import { fakeBrevo } from "./brevo";
import { useTestDatabase } from "./database";
import { createUser, randomIp } from "./factories";
import { captureLogs } from "./logs";

/** Ramki stosu z `errorSummary` — treść zależy od maszyny. */
const ANY_STACK: unknown = expect.any(String);

// AC2, SEC1 (TH-21) T-055: awaria Brevo nie zmienia odpowiedzi prośby o reset (SEC1 T-053);
// w logu tylko typ błędu i status — bez e-maila, tokenu, treści i klucza API. T-098: wpis
// w kształcie błędów w tle — `event` i `err` z `errorSummary`, status dostawcy obok.
describe("password reset when Brevo fails (AC2, SEC1)", () => {
  const db = useTestDatabase();
  let brevo: Awaited<ReturnType<typeof fakeBrevo>> | undefined;

  afterEach(async () => {
    await brevo?.stop();
    brevo = undefined;
  });

  it("still answers 200 and logs only the provider status", async () => {
    brevo = await fakeBrevo((response) =>
      response.writeHead(500).end(JSON.stringify({ message: "internal error" })),
    );
    const logs = captureLogs();
    const app = buildTestApp(db.pool, {
      logger: { level: "info", stream: logs.stream },
      mailer: new BrevoMailer({
        apiKey: "brevo-test-key-0123",
        sender: "wlasciciel@example.com",
        baseUrl: brevo.url,
      }),
    });
    const local = `brevo${randomUUID().slice(0, 8)}`;
    await createUser(app, { email: `${local}@example.com` });

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/request-password-reset",
      headers: { origin: TEST_ORIGIN },
      remoteAddress: randomIp(),
      payload: { email: `${local}@example.com` },
    });

    expect(response.statusCode).toBe(200);
    await vi.waitFor(() => {
      expect(
        logs.entries().filter((entry) => entry["event"] === "password_reset_mail_failed"),
      ).toEqual([
        expect.objectContaining({
          level: 50,
          err: { type: "MailDeliveryError", stack: ANY_STACK },
          status: 500,
        }),
      ]);
    });
    expect(brevo.received).toHaveLength(1);
    const text = logs.lines.join("\n");
    for (const secret of [local, "brevo-test-key-0123", "wlasciciel", "token=", "Kliknij"]) {
      expect(text).not.toContain(secret);
    }
    await app.close();
  });
});
