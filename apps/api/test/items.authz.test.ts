import { describe, expect, it } from "vitest";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { createItem, createList, createUser } from "./factories";
import { requestsAs } from "./requests";

const NOT_FOUND = { error: { code: "not_found" } };

// SEC1 (TH-01, MC-01): pozycje cudzej listy są niewidoczne i niezmienialne.
describe("items of someone else's list", () => {
  const db = useTestDatabase();

  async function setUp() {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app);
    const bartek = await createUser(app);
    const listA = await createList(db.pool, ania);
    const listB = await createList(db.pool, bartek);
    const milk = await createItem(db.pool, listA, ania, "Mleko");
    return { app, bartek, listA, listB, milk };
  }

  async function itemsOf(listId: string) {
    const { rows } = await db.pool.query<{ id: string; name: string; note: string | null }>(
      "SELECT id, name, note FROM item WHERE list_id = $1 ORDER BY name",
      [listId],
    );
    return rows;
  }

  function requestsOn(listId: string, itemId: string) {
    return [
      ["POST", `/api/v1/lists/${listId}/items`, { name: "Obce" }],
      ["PATCH", `/api/v1/lists/${listId}/items/${itemId}`, { name: "Zmienione", note: "x" }],
      ["DELETE", `/api/v1/lists/${listId}/items/${itemId}`, undefined],
    ] as const;
  }

  it("answers another household member 404 for POST, PATCH and DELETE and changes nothing", async () => {
    const { app, bartek, listA, milk } = await setUp();
    const asBartek = requestsAs(app, bartek);

    for (const [method, url, body] of requestsOn(listA.id, milk.id)) {
      const response = await asBartek(method, url, body);
      expect(response.statusCode, `${method} ${url}`).toBe(404);
      expect(response.json()).toEqual(NOT_FOUND);
    }
    expect(await itemsOf(listA.id)).toEqual([{ id: milk.id, name: "Mleko", note: null }]);
    await app.close();
  });

  it("answers an anonymous request 401 and changes nothing", async () => {
    const { app, listA, milk } = await setUp();
    const anonymous = requestsAs(app, null);

    for (const [method, url, body] of requestsOn(listA.id, milk.id)) {
      const response = await anonymous(method, url, body);
      expect(response.statusCode, `${method} ${url}`).toBe(401);
    }
    expect(await itemsOf(listA.id)).toEqual([{ id: milk.id, name: "Mleko", note: null }]);
    await app.close();
  });

  it("answers 404 when an item of list A is addressed through own list B", async () => {
    const { app, bartek, listA, listB, milk } = await setUp();
    const asBartek = requestsAs(app, bartek);

    const patch = await asBartek("PATCH", `/api/v1/lists/${listB.id}/items/${milk.id}`, {
      name: "Przejęte",
    });
    const remove = await asBartek("DELETE", `/api/v1/lists/${listB.id}/items/${milk.id}`);

    expect(patch.statusCode).toBe(404);
    expect(patch.json()).toEqual(NOT_FOUND);
    expect(remove.statusCode).toBe(404);
    expect(await itemsOf(listA.id)).toEqual([{ id: milk.id, name: "Mleko", note: null }]);
    await app.close();
  });
});
