import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { createUser } from "./factories";

const DAY_MS = 24 * 60 * 60 * 1000;
const START = new Date("2026-11-02T10:00:00.000Z");

// Better Auth liczy czas przez Date.now(), więc zegarem sterujemy na tej granicy.
describe("session lifetime (SEC6: TH-17)", () => {
  const db = useTestDatabase();

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(START);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function expiresAt(userId: string): Promise<number> {
    const { rows } = await db.pool.query<{ expires_at: Date }>(
      "SELECT expires_at FROM session WHERE user_id = $1",
      [userId],
    );
    expect(rows).toHaveLength(1);
    return rows[0]?.expires_at.getTime() ?? 0;
  }

  function me(app: ReturnType<typeof buildTestApp>, cookie: string) {
    return app.inject({ method: "GET", url: "/api/v1/me", headers: { cookie } });
  }

  it("expires a new session 30 days after it was created", async () => {
    const app = buildTestApp(db.pool);

    const user = await createUser(app);

    expect(await expiresAt(user.id)).toBe(START.getTime() + 30 * DAY_MS);
    await app.close();
  });

  it("extends the session to 30 days from the last use", async () => {
    const app = buildTestApp(db.pool);
    const user = await createUser(app);

    vi.setSystemTime(START.getTime() + 2 * DAY_MS);
    expect((await me(app, user.cookie)).statusCode).toBe(200);

    expect(await expiresAt(user.id)).toBe(START.getTime() + 32 * DAY_MS);
    await app.close();
  });

  it("rejects the session after 30 days without use", async () => {
    const app = buildTestApp(db.pool);
    const user = await createUser(app);

    vi.setSystemTime(START.getTime() + 30 * DAY_MS + 1000);

    expect((await me(app, user.cookie)).statusCode).toBe(401);
    await app.close();
  });
});
