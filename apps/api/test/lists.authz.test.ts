import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { addMember, createList, createUser } from "./factories";
import { captureLogs } from "./logs";
import { requestsAs } from "./requests";

const NOT_FOUND = { error: { code: "not_found" } };

// SEC1, SEC2, SEC4 (TH-01, TH-02): testing-strategy.md, „Testy bezpieczeństwa”.
describe("authorization of /api/v1/lists", () => {
  const db = useTestDatabase();

  async function listOfAnia(logger?: ReturnType<typeof captureLogs>) {
    const app = buildTestApp(
      db.pool,
      logger ? { logger: { level: "info", stream: logger.stream } } : {},
    );
    const ania = await createUser(app);
    const tomek = await createUser(app);
    const bartek = await createUser(app);
    const list = await createList(db.pool, ania, "Lista Ani");
    await addMember(db.pool, list, tomek);
    return { app, ania, tomek, bartek, list };
  }

  async function storedName(listId: string) {
    const { rows } = await db.pool.query<{ name: string }>(
      "SELECT name FROM shopping_list WHERE id = $1",
      [listId],
    );
    return rows[0]?.name;
  }

  it("answers someone else's list exactly like a list that does not exist", async () => {
    const { app, bartek, list } = await listOfAnia();
    const asBartek = requestsAs(app, bartek);

    for (const [method, payload] of [
      ["GET", undefined],
      ["PATCH", { name: "Przejęta" }],
      ["DELETE", undefined],
    ] as const) {
      const foreign = await asBartek(method, `/api/v1/lists/${list.id}`, payload);
      const missing = await asBartek(method, `/api/v1/lists/${randomUUID()}`, payload);
      const malformed = await asBartek(method, "/api/v1/lists/nie-uuid", payload);

      for (const response of [foreign, missing, malformed]) {
        expect(response.statusCode).toBe(404);
        expect(response.json()).toEqual(NOT_FOUND);
      }
      expect(foreign.body).toBe(missing.body);
    }
    expect(await storedName(list.id)).toBe("Lista Ani");
    expect((await asBartek("GET", "/api/v1/lists")).json()).toEqual([]);
    await app.close();
  });

  it("answers 401 to an anonymous request on every list route", async () => {
    const { app, list } = await listOfAnia();
    const anonymous = requestsAs(app, null);

    for (const [method, url, payload] of [
      ["GET", "/api/v1/lists", undefined],
      ["POST", "/api/v1/lists", { name: "Anonimowa" }],
      ["GET", `/api/v1/lists/${list.id}`, undefined],
      ["PATCH", `/api/v1/lists/${list.id}`, { name: "Anonimowa" }],
      ["DELETE", `/api/v1/lists/${list.id}`, undefined],
    ] as const) {
      const response = await anonymous(method, url, payload);

      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ error: { code: "unauthenticated" } });
    }
    expect(await storedName(list.id)).toBe("Lista Ani");
    await app.close();
  });

  it("refuses a participant renaming or deleting the list with 403 owner_only", async () => {
    const { app, tomek, list } = await listOfAnia();
    const asTomek = requestsAs(app, tomek);

    const rename = await asTomek("PATCH", `/api/v1/lists/${list.id}`, { name: "Moja" });
    const remove = await asTomek("DELETE", `/api/v1/lists/${list.id}`);

    for (const response of [rename, remove]) {
      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({ error: { code: "owner_only" } });
    }
    expect(await storedName(list.id)).toBe("Lista Ani");
    await app.close();
  });

  it("logs a refused access in the security log with identifiers only", async () => {
    const logs = captureLogs();
    const { app, bartek, tomek, list } = await listOfAnia(logs);

    await requestsAs(app, bartek)("GET", `/api/v1/lists/${list.id}`);
    await requestsAs(app, tomek)("DELETE", `/api/v1/lists/${list.id}`);

    const denied = logs.security().filter((entry) => entry["event"] === "list_access_denied");
    expect(denied.map((entry) => [entry["userId"], entry["listId"]])).toEqual([
      [bartek.id, list.id],
      [tomek.id, list.id],
    ]);
    for (const entry of denied) expect(typeof entry["requestId"]).toBe("string");
    expect(logs.lines.join("\n")).not.toContain("Lista Ani");
    await app.close();
  });

  // TH-14 (layers/backend.md): żądania zmieniające stan tylko z zaufanego originu.
  it("rejects state-changing requests from a foreign Origin with 403 invalid_origin", async () => {
    const { app, ania, list } = await listOfAnia();

    for (const [method, url, payload] of [
      ["POST", "/api/v1/lists", { name: "Z obcej strony" }],
      ["PATCH", `/api/v1/lists/${list.id}`, { name: "Z obcej strony" }],
      ["DELETE", `/api/v1/lists/${list.id}`, undefined],
    ] as const) {
      const response = await app.inject({
        method,
        url,
        headers: { origin: "https://evil.example", cookie: ania.cookie },
        ...(payload ? { payload } : {}),
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({ error: { code: "invalid_origin" } });
    }
    expect(await storedName(list.id)).toBe("Lista Ani");
    const { rows } = await db.pool.query("SELECT 1 FROM shopping_list");
    expect(rows).toHaveLength(1);
    await app.close();
  });
});
