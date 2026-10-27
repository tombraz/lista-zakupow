import { describe, expect, it } from "vitest";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { createUser } from "./factories";

const EVIL = "https://evil.example";

// TH-14: obca strona nie może wysłać żądania zmieniającego stan w imieniu przeglądarki domownika.
describe("untrusted Origin (SEC4)", () => {
  const db = useTestDatabase();

  async function sessionCount(): Promise<number> {
    const { rows } = await db.pool.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM session",
    );
    return rows[0]?.count ?? 0;
  }

  it("rejects sign-up with 403 invalid_origin and creates no account", async () => {
    const app = buildTestApp(db.pool);

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      headers: { origin: EVIL },
      payload: {
        name: "Ania",
        email: "ania@example.com",
        password: "dobre-haslo-1",
        termsAccepted: true,
        ageConfirmed: true,
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: { code: "invalid_origin" } });
    const { rows } = await db.pool.query(`SELECT 1 FROM "user"`);
    expect(rows).toEqual([]);
    await app.close();
  });

  it("rejects sign-in with 403 and starts no session", async () => {
    const app = buildTestApp(db.pool);
    const user = await createUser(app);
    const before = await sessionCount();

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      headers: { origin: EVIL },
      payload: { email: user.email, password: user.password },
    });

    expect(response.statusCode).toBe(403);
    expect(response.headers["set-cookie"]).toBeUndefined();
    expect(await sessionCount()).toBe(before);
    await app.close();
  });

  it("rejects sign-out with 403 and keeps the session", async () => {
    const app = buildTestApp(db.pool);
    const user = await createUser(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/sign-out",
      headers: { origin: EVIL, cookie: user.cookie },
    });

    expect(response.statusCode).toBe(403);
    expect(await sessionCount()).toBe(1);
    await app.close();
  });
});
