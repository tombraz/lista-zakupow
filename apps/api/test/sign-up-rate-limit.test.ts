import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildTestApp, TEST_ORIGIN } from "./app";
import { useTestDatabase } from "./database";
import { randomIp } from "./factories";

function account() {
  return {
    name: "Domownik",
    email: `user-${randomUUID()}@example.com`,
    password: "dobre-haslo-1",
    termsAccepted: true,
    ageConfirmed: true,
  };
}

// MC-05: 5 rejestracji na godzinę z jednego IP; treść żądania do 16 kB.
describe("sign-up limits (SEC3: TH-13)", () => {
  const db = useTestDatabase();

  function signUp(app: ReturnType<typeof buildTestApp>, payload: object, ip: string) {
    return app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      headers: { origin: TEST_ORIGIN },
      remoteAddress: ip,
      payload,
    });
  }

  it("answers 429 rate_limited to the 6th sign-up from one IP within an hour", async () => {
    const app = buildTestApp(db.pool);
    const ip = randomIp();
    const statuses: number[] = [];

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      statuses.push((await signUp(app, account(), ip)).statusCode);
    }
    const sixth = await signUp(app, account(), ip);

    expect(statuses).toEqual([200, 200, 200, 200, 200]);
    expect(sixth.statusCode).toBe(429);
    expect(sixth.json()).toEqual({ error: { code: "rate_limited" } });
    const { rows } = await db.pool.query(`SELECT 1 FROM "user"`);
    expect(rows).toHaveLength(5);
    await app.close();
  });

  it("answers 413 to a sign-up body larger than 16 kB", async () => {
    const app = buildTestApp(db.pool);

    const response = await signUp(app, { ...account(), name: "x".repeat(16 * 1024) }, randomIp());

    expect(response.statusCode).toBe(413);
    await app.close();
  });
});
