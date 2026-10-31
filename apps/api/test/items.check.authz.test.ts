import { describe, expect, it } from "vitest";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { createItem, createList, createUser } from "./factories";
import { requestsAs } from "./requests";

const NOT_FOUND = { error: { code: "not_found" } };

// SEC1 (TH-01, MC-01): odhaczanie i usuwanie kupionych na cudzej liście nic nie zmienia.
describe("checking and clearing items of someone else's list", () => {
  const db = useTestDatabase();

  async function setUp() {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app);
    const bartek = await createUser(app);
    const listA = await createList(db.pool, ania);
    const listB = await createList(db.pool, bartek);
    const milk = await createItem(db.pool, listA, ania, "Mleko");
    const bread = await createItem(db.pool, listA, ania, "Chleb");
    await requestsAs(app, ania)("PATCH", `/api/v1/lists/${listA.id}/items/${bread.id}`, {
      checked: true,
    });
    const before = await stateOf(listA.id);
    return { app, ania, bartek, listA, listB, milk, bread, before };
  }

  async function stateOf(listId: string) {
    const items = await db.pool.query<{ name: string; checked_by: string | null }>(
      "SELECT name, checked_by FROM item WHERE list_id = $1 ORDER BY name",
      [listId],
    );
    const activity = await db.pool.query<{ user_id: string; checks: number }>(
      "SELECT user_id, checks FROM list_daily_activity WHERE list_id = $1 ORDER BY user_id",
      [listId],
    );
    return { items: items.rows, activity: activity.rows };
  }

  function requestsOn(listId: string, milkId: string, breadId: string) {
    return [
      ["PATCH", `/api/v1/lists/${listId}/items/${milkId}`, { checked: true }],
      ["PATCH", `/api/v1/lists/${listId}/items/${breadId}`, { checked: false }],
      ["POST", `/api/v1/lists/${listId}/items/clear-checked`, undefined],
    ] as const;
  }

  it("answers another household member 404 and changes neither items nor activity", async () => {
    const { app, bartek, listA, milk, bread, before } = await setUp();
    const asBartek = requestsAs(app, bartek);

    for (const [method, url, body] of requestsOn(listA.id, milk.id, bread.id)) {
      const response = await asBartek(method, url, body);
      expect(response.statusCode, `${method} ${url}`).toBe(404);
      expect(response.json()).toEqual(NOT_FOUND);
    }
    expect(await stateOf(listA.id)).toEqual(before);
    await app.close();
  });

  it("answers an anonymous request 401 and changes nothing", async () => {
    const { app, listA, milk, bread, before } = await setUp();
    const anonymous = requestsAs(app, null);

    for (const [method, url, body] of requestsOn(listA.id, milk.id, bread.id)) {
      const response = await anonymous(method, url, body);
      expect(response.statusCode, `${method} ${url}`).toBe(401);
    }
    expect(await stateOf(listA.id)).toEqual(before);
    await app.close();
  });

  it("answers 404 when an item of list A is checked through own list B", async () => {
    const { app, bartek, listA, listB, milk, before } = await setUp();

    const response = await requestsAs(app, bartek)(
      "PATCH",
      `/api/v1/lists/${listB.id}/items/${milk.id}`,
      { checked: true },
    );

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(NOT_FOUND);
    expect(await stateOf(listA.id)).toEqual(before);
    expect((await stateOf(listB.id)).activity).toEqual([]);
    await app.close();
  });

  it("answers 404 for a non-UUID item id", async () => {
    const { app, ania, listA, before } = await setUp();

    const response = await requestsAs(app, ania)(
      "PATCH",
      `/api/v1/lists/${listA.id}/items/not-a-uuid`,
      { checked: true },
    );

    expect(response.statusCode).toBe(404);
    expect(await stateOf(listA.id)).toEqual(before);
    await app.close();
  });
});
