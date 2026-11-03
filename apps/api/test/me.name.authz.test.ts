import { describe, expect, it } from "vitest";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { createUser } from "./factories";
import { requestsAs } from "./requests";

// T-061 SEC2: anonim 401, obcy `Origin` 403 (TH-14); imię bez zmian.
describe("PATCH /api/v1/me access", () => {
  const db = useTestDatabase();

  it("answers 401 to an anonymous request", async () => {
    const app = buildTestApp(db.pool);

    const response = await requestsAs(app, null)("PATCH", "/api/v1/me", { name: "Tomasz" });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: { code: "unauthenticated" } });
    await app.close();
  });

  it("answers 403 invalid_origin to a request from a foreign origin and keeps the name", async () => {
    const app = buildTestApp(db.pool);
    const tomek = await createUser(app, { name: "Tomek" });

    const response = await app.inject({
      method: "PATCH",
      url: "/api/v1/me",
      headers: { origin: "https://evil.example", cookie: tomek.cookie },
      payload: { name: "Tomasz" },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: { code: "invalid_origin" } });
    const me = await requestsAs(app, tomek)("GET", "/api/v1/me");
    expect(me.json<{ name: string }>().name).toBe("Tomek");
    await app.close();
  });
});
