import { afterEach, describe, expect, it, vi } from "vitest";
import { MailDeliveryError, MailTimeoutError } from "../src/modules/konta/domain/mailer";
import { BrevoMailer } from "../src/modules/konta/infra/brevo-mailer";
import { fakeBrevo } from "./brevo";
import { pause } from "./live";

const MAIL = {
  to: "ania@example.com",
  subject: "Reset hasła — Wspólna lista zakupów",
  text: "Kliknij link: https://lista.example/reset-hasla?token=abc ąę",
};

describe("Brevo mailer (AC1)", () => {
  let brevo: Awaited<ReturnType<typeof fakeBrevo>> | undefined;

  afterEach(async () => {
    await brevo?.stop();
    brevo = undefined;
  });

  it("posts the mail to /v3/smtp/email with the api-key header and the configured sender", async () => {
    brevo = await fakeBrevo();
    const mailer = new BrevoMailer({
      apiKey: "test-api-key",
      sender: "wlasciciel@example.com",
      baseUrl: brevo.url,
    });

    await mailer.send(MAIL);

    expect(brevo.received).toEqual([
      {
        method: "POST",
        path: "/v3/smtp/email",
        headers: expect.objectContaining({
          "api-key": "test-api-key",
          "content-type": "application/json",
          accept: "application/json",
        }) as unknown,
        body: {
          sender: { email: "wlasciciel@example.com", name: "Wspólna lista zakupów" },
          to: [{ email: "ania@example.com" }],
          subject: "Reset hasła — Wspólna lista zakupów",
          textContent: "Kliknij link: https://lista.example/reset-hasla?token=abc ąę",
        },
      },
    ]);
  });

  it("talks to https://api.brevo.com by default", () => {
    const mailer = new BrevoMailer({ apiKey: "k", sender: "wlasciciel@example.com" });

    expect(mailer.endpoint).toBe("https://api.brevo.com/v3/smtp/email");
  });
});

// AC2, SEC1 (TH-21): odmowa lub milczenie Brevo = odrzucenie z samym statusem; w błędzie nie ma
// adresu, treści maila (link z tokenem) ani klucza — moduł `konta` loguje tylko typ i status.
describe("Brevo mailer failures (AC2, SEC1)", () => {
  let brevo: Awaited<ReturnType<typeof fakeBrevo>> | undefined;

  afterEach(async () => {
    vi.useRealTimers();
    await brevo?.stop();
    brevo = undefined;
  });

  function mailerFor(url: string) {
    return new BrevoMailer({
      apiKey: "test-api-key",
      sender: "wlasciciel@example.com",
      baseUrl: url,
    });
  }

  function expectNoPersonalData(error: unknown) {
    const described = `${String(error)} ${JSON.stringify(error)} ${(error as Error).stack ?? ""}`;
    for (const secret of [
      "ania@example.com",
      "token=abc",
      "Kliknij",
      "test-api-key",
      "wlasciciel",
    ]) {
      expect(described).not.toContain(secret);
    }
  }

  it.each([400, 401, 429, 500, 503])(
    "rejects with status %i and no personal data",
    async (status) => {
      // Brevo odsyła w treści błędu m.in. adres odbiorcy — adapter jej nie czyta.
      brevo = await fakeBrevo((response) =>
        response.writeHead(status).end(JSON.stringify({ message: `invalid ${MAIL.to}` })),
      );

      const error: unknown = await mailerFor(brevo.url)
        .send(MAIL)
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(MailDeliveryError);
      expect(error).toMatchObject({ status });
      expectNoPersonalData(error);
    },
  );

  it("gives up after 10 s without an answer", async () => {
    brevo = await fakeBrevo(() => {
      // Brevo milczy.
    });
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    let settled: unknown = "pending";
    const sending = mailerFor(brevo.url)
      .send(MAIL)
      .then(
        () => "sent",
        (error: unknown) => error,
      );
    void sending.then((result) => (settled = result));
    while (brevo.started() === 0) await pause(5);

    await vi.advanceTimersByTimeAsync(9_999);
    expect(settled).toBe("pending");
    await vi.advanceTimersByTimeAsync(1);
    for (let tries = 0; settled === "pending" && tries < 100; tries += 1) await pause(5);

    expect(settled).toBeInstanceOf(MailTimeoutError);
    expectNoPersonalData(settled);
  });
});
