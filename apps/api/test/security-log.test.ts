import { describe, expect, it } from "vitest";
import { buildTestApp, TEST_ORIGIN } from "./app";
import { cookieHeader } from "./cookies";
import { useTestDatabase } from "./database";
import { randomIp } from "./factories";
import { captureLogs } from "./logs";

const EMAIL = "tajny.adres@example.com";
const PASSWORD = "tajne-haslo-123";

// TH-21: zdarzenia bezpieczeństwa z identyfikatorami; w żadnym wpisie e-mail, hasło, ciasteczko.
describe("security log (SEC7)", () => {
  const db = useTestDatabase();

  it("logs failed sign-ins and rate limiting without e-mail, password or cookie", async () => {
    const logs = captureLogs();
    const app = buildTestApp(db.pool, { logger: { level: "info", stream: logs.stream } });
    const ip = randomIp();
    const signUp = await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      headers: { origin: TEST_ORIGIN },
      remoteAddress: ip,
      payload: {
        name: "Ania",
        email: EMAIL,
        password: PASSWORD,
        termsAccepted: true,
        ageConfirmed: true,
      },
    });
    const cookie = cookieHeader(signUp.headers["set-cookie"]);
    await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      headers: { origin: TEST_ORIGIN },
      remoteAddress: ip,
      payload: {
        name: "Ania",
        email: EMAIL,
        password: PASSWORD,
        termsAccepted: true,
        ageConfirmed: true,
      },
    });
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      await app.inject({
        method: "POST",
        url: "/api/auth/sign-in/email",
        headers: { origin: TEST_ORIGIN, cookie },
        remoteAddress: randomIp(),
        payload: { email: EMAIL, password: `${PASSWORD}-zle` },
      });
    }

    const security = logs.security();
    const failed = security.filter((entry) => entry["event"] === "sign_in_failed");
    const limited = security.filter((entry) => entry["event"] === "rate_limited");
    expect(failed).toHaveLength(5);
    expect(limited).toHaveLength(1);
    for (const entry of [...failed, ...limited]) {
      expect(entry["accountKey"]).toEqual(expect.any(String));
      expect(entry["requestId"]).toEqual(expect.any(String));
    }
    const all = logs.lines.join("\n");
    for (const secret of [EMAIL, PASSWORD, cookie.split("=")[1] ?? cookie]) {
      expect(all).not.toContain(secret);
    }
    await app.close();
  });

  // T-041: `route` zdarzenia to wzorzec trasy, nie surowy adres z query.
  it("logs the route pattern, not the raw URL, for a failed sign-in", async () => {
    const logs = captureLogs();
    const app = buildTestApp(db.pool, { logger: { level: "info", stream: logs.stream } });
    await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email?x=1",
      headers: { origin: TEST_ORIGIN },
      remoteAddress: randomIp(),
      payload: { email: EMAIL, password: PASSWORD },
    });

    expect(logs.security()).toEqual([
      expect.objectContaining({ event: "sign_in_failed", route: "/api/auth/sign-in/email" }),
    ]);
    await app.close();
  });
});
