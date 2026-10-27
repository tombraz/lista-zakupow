import { describe, expect, it } from "vitest";
import { buildTestApp, TEST_ORIGIN } from "./app";
import { useTestDatabase } from "./database";
import { createUser } from "./factories";

describe("POST /api/auth/sign-out (AC5)", () => {
  const db = useTestDatabase();

  it("deletes the session, so the old cookie gets 401 from GET /api/v1/me", async () => {
    const app = buildTestApp(db.pool);
    const user = await createUser(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/sign-out",
      headers: { origin: TEST_ORIGIN, cookie: user.cookie },
    });

    expect(response.statusCode).toBe(200);
    const { rows } = await db.pool.query(`SELECT 1 FROM session WHERE user_id = $1`, [user.id]);
    expect(rows).toEqual([]);
    const me = await app.inject({
      method: "GET",
      url: "/api/v1/me",
      headers: { cookie: user.cookie },
    });
    expect(me.statusCode).toBe(401);
    expect(me.json()).toEqual({ error: { code: "unauthenticated" } });
    await app.close();
  });

  it("answers 401 unauthenticated to GET /api/v1/me without a cookie", async () => {
    const app = buildTestApp(db.pool);

    const me = await app.inject({ method: "GET", url: "/api/v1/me" });

    expect(me.statusCode).toBe(401);
    expect(me.json()).toEqual({ error: { code: "unauthenticated" } });
    await app.close();
  });
});
