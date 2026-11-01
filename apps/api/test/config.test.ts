import { describe, expect, it } from "vitest";
import { readConfig } from "../src/config";

const environment = {
  DATABASE_URL: "postgres://lista:lista@localhost:5442/lista",
  BETTER_AUTH_SECRET: "x".repeat(32),
  APP_ORIGIN: "https://lista.example",
  MAILPIT_URL: "http://localhost:8025",
};

// QA round 1, #9: bez APP_ORIGIN API nie może po cichu przyjąć adresu deweloperskiego.
describe("readConfig", () => {
  it("refuses to start without APP_ORIGIN", () => {
    const withoutOrigin = { ...environment, APP_ORIGIN: undefined };

    expect(() => readConfig(withoutOrigin)).toThrow(/APP_ORIGIN/);
    expect(() => readConfig({ ...withoutOrigin, APP_ORIGIN: "" })).toThrow(/APP_ORIGIN/);
  });

  it("takes the public address from APP_ORIGIN", () => {
    expect(readConfig(environment).APP_ORIGIN).toBe("https://lista.example");
  });

  // F-03: bez dostawcy maili reset hasła po cichu by nie działał — błąd startu, także na produkcji.
  it("refuses to start without a mail provider", () => {
    const withoutMail = { ...environment, MAILPIT_URL: undefined };

    expect(() => readConfig(withoutMail)).toThrow(/MAILPIT_URL/);
    expect(() => readConfig({ ...withoutMail, MAILPIT_URL: "" })).toThrow(/MAILPIT_URL/);
  });

  // AC3 T-055: serwer z Brevo bez klucza albo nadawcy = błąd startu, nie cicha wysyłka donikąd.
  const brevo = {
    DATABASE_URL: environment.DATABASE_URL,
    BETTER_AUTH_SECRET: environment.BETTER_AUTH_SECRET,
    APP_ORIGIN: environment.APP_ORIGIN,
    MAILER: "brevo",
    BREVO_API_KEY: "test-brevo-key",
    MAIL_FROM: "wlasciciel@example.com",
  };

  it("takes the Brevo key and the sender when MAILER=brevo, without MAILPIT_URL", () => {
    expect(readConfig(brevo).mail).toEqual({
      provider: "brevo",
      apiKey: "test-brevo-key",
      sender: "wlasciciel@example.com",
    });
  });

  it.each(["BREVO_API_KEY", "MAIL_FROM"])(
    "refuses to start with MAILER=brevo without %s",
    (name) => {
      expect(() => readConfig({ ...brevo, [name]: undefined })).toThrow(new RegExp(name));
      expect(() => readConfig({ ...brevo, [name]: "" })).toThrow(new RegExp(name));
    },
  );

  it("refuses a sender that is not an e-mail address", () => {
    expect(() => readConfig({ ...brevo, MAIL_FROM: "właściciel" })).toThrow(/MAIL_FROM/);
  });

  it("refuses an unknown MAILER", () => {
    expect(() => readConfig({ ...environment, MAILER: "smtp" })).toThrow(/MAILER/);
  });

  it("uses Mailpit when MAILER is not set", () => {
    expect(readConfig(environment).mail).toEqual({
      provider: "mailpit",
      url: "http://localhost:8025",
    });
  });
});
