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

  it("takes the Mailpit address from MAILPIT_URL", () => {
    expect(readConfig(environment).MAILPIT_URL).toBe("http://localhost:8025");
  });
});
