import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { buildTestApp, TEST_ORIGIN } from "./app";
import { cookieHeader } from "./cookies";
import { useTestDatabase } from "./database";
import { randomIp } from "./factories";

const EMAIL = "tajny.adres@example.com";
const PASSWORD = "tajne-haslo-123";

function captureLogs() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, done) {
      lines.push(...chunk.toString("utf8").split("\n").filter(Boolean));
      done();
    },
  });
  const entries = () => lines.map((line) => JSON.parse(line) as Record<string, unknown>);
  return { stream, lines, entries };
}

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

    const security = logs.entries().filter((entry) => entry["channel"] === "security");
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
});
