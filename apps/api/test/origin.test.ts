import { describe, expect, it } from "vitest";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { createItem, createList, createUser } from "./factories";

const EVIL = "https://evil.example";

/**
 * TH-26: router dopasowuje trasę po zdekodowanej ścieżce, więc te zapisy trafiają do tej samej
 * trasy co kanoniczny. Kontrola musi je traktować tak samo.
 */
function spellings(path: string): string[] {
  return [
    path,
    path.replace("/api/", "/%61pi/"),
    path.replace("/v1/", "/%761/"),
    path.replace("/lists", "/%6cists"),
    `${path}?x=1`,
  ];
}

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

  it("rejects state-changing requests to /api/v1 routes without a trusted Origin, whatever the path spelling", async () => {
    const app = buildTestApp(db.pool);
    const user = await createUser(app);
    const list = await createList(db.pool, user, "Dom");
    const item = await createItem(db.pool, list, user, "Mleko");
    const requests = [
      { method: "POST", path: "/api/v1/lists", payload: { name: "Obca" } },
      { method: "PATCH", path: `/api/v1/lists/${list.id}`, payload: { name: "Obca" } },
      { method: "DELETE", path: `/api/v1/lists/${list.id}` },
      { method: "POST", path: `/api/v1/lists/${list.id}/items`, payload: { name: "Obca" } },
      { method: "DELETE", path: `/api/v1/lists/${list.id}/items/${item.id}` },
      { method: "POST", path: `/api/v1/lists/${list.id}/invitations` },
    ] as const;

    for (const { method, path, ...rest } of requests) {
      for (const url of spellings(path)) {
        for (const origin of [EVIL, undefined]) {
          const response = await app.inject({
            method,
            url,
            headers: { cookie: user.cookie, ...(origin ? { origin } : {}) },
            ...rest,
          });

          expect({ method, url, origin, status: response.statusCode }).toEqual({
            method,
            url,
            origin,
            status: 403,
          });
          expect(response.json()).toEqual({ error: { code: "invalid_origin" } });
        }
      }
    }
    const { rows } = await db.pool.query<{ lists: number; items: number; invitations: number }>(
      `SELECT (SELECT count(*)::int FROM shopping_list) AS lists,
              (SELECT count(*)::int FROM item) AS items,
              (SELECT count(*)::int FROM invitation) AS invitations`,
    );
    expect(rows[0]).toEqual({ lists: 1, items: 1, invitations: 0 });
    const { rows: names } = await db.pool.query(`SELECT name FROM shopping_list`);
    expect(names).toEqual([{ name: "Dom" }]);
    await app.close();
  });

  it("rejects auth requests with a foreign Origin on path variants without a 500", async () => {
    const app = buildTestApp(db.pool);
    const user = await createUser(app);
    const before = await sessionCount();

    for (const url of ["/api/%61uth/sign-in/email", "/%61pi/auth/sign-in/email"]) {
      const response = await app.inject({
        method: "POST",
        url,
        headers: { origin: EVIL },
        payload: { email: user.email, password: user.password },
      });

      expect({ url, status: response.statusCode }).toEqual({ url, status: 403 });
      expect(response.headers["set-cookie"]).toBeUndefined();
    }
    const signUp = await app.inject({
      method: "POST",
      url: "/api/%61uth/sign-up/email",
      headers: { origin: EVIL },
      payload: {
        name: "Ania",
        email: "ania@example.com",
        password: "dobre-haslo-1",
        termsAccepted: true,
        ageConfirmed: true,
      },
    });

    expect(signUp.statusCode).toBe(403);
    expect(await sessionCount()).toBe(before);
    const { rows } = await db.pool.query(`SELECT 1 FROM "user" WHERE email = 'ania@example.com'`);
    expect(rows).toEqual([]);
    await app.close();
  });

  it("keeps safe methods free of the Origin rule and unknown routes at 404", async () => {
    const app = buildTestApp(db.pool);
    const user = await createUser(app);

    const read = await app.inject({
      method: "GET",
      url: "/api/%761/lists",
      headers: { cookie: user.cookie },
    });
    const unknown = await app.inject({
      method: "POST",
      url: "/api/v1/nope",
      headers: { cookie: user.cookie, origin: EVIL },
    });

    expect(read.statusCode).toBe(200);
    expect(unknown.statusCode).toBe(404);
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
