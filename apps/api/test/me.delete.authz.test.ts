import { describe, expect, it } from "vitest";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { addMember, createList, createUser } from "./factories";
import { requestsAs } from "./requests";

// T-062 AC2, SEC4 (F-04, TH-14): usunięcie wymaga wyraźnego potwierdzenia, sesji i zaufanego Origin.
describe("DELETE /api/v1/me refusals", () => {
  const db = useTestDatabase();

  it.each([
    ["no body", undefined],
    ["an empty body", {}],
    ["confirm: false", { confirm: false }],
    ['confirm: "true"', { confirm: "true" }],
  ])("answers 400 and changes nothing for %s", async (_case, payload) => {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app);
    const tomek = await createUser(app);
    const list = await createList(db.pool, ania);
    await addMember(db.pool, list, tomek);
    const asAnia = requestsAs(app, ania);

    const response = await asAnia("DELETE", "/api/v1/me", payload);

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: { code: "validation_failed", fields: { confirm: "required" } },
    });
    expect((await asAnia("GET", "/api/v1/me")).statusCode).toBe(200);
    expect((await requestsAs(app, tomek)("GET", `/api/v1/lists/${list.id}`)).statusCode).toBe(200);
    await app.close();
  });

  it("answers 401 to an anonymous request", async () => {
    const app = buildTestApp(db.pool);

    const response = await requestsAs(app, null)("DELETE", "/api/v1/me", { confirm: true });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: { code: "unauthenticated" } });
    await app.close();
  });

  it.each([
    ["a foreign Origin", { origin: "https://evil.example" }],
    ["no Origin", {}],
  ])("answers 403 invalid_origin with %s and keeps the account", async (_case, headers) => {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app);

    const response = await app.inject({
      method: "DELETE",
      url: "/api/v1/me",
      headers: { ...headers, cookie: ania.cookie },
      payload: { confirm: true },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: { code: "invalid_origin" } });
    expect((await requestsAs(app, ania)("GET", "/api/v1/me")).statusCode).toBe(200);
    await app.close();
  });
});
