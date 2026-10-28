import { describe, expect, it } from "vitest";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { createItem, createList, createUser } from "./factories";
import { requestsAs } from "./requests";

// AC4 (F-08): „Usuń wszystkie kupione” usuwa odhaczone, nieodhaczone zostają.
describe("POST /api/v1/lists/:listId/items/clear-checked", () => {
  const db = useTestDatabase();

  async function twoBoughtOneToBuy() {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app);
    const list = await createList(db.pool, ania);
    const milk = await createItem(db.pool, list, ania, "Mleko");
    const bread = await createItem(db.pool, list, ania, "Chleb");
    const eggs = await createItem(db.pool, list, ania, "Jajka");
    const as = requestsAs(app, ania);
    for (const { id } of [bread, eggs]) {
      await as("PATCH", `/api/v1/lists/${list.id}/items/${id}`, { checked: true });
    }
    return { app, ania, as, list, milk, bread, eggs };
  }

  async function namesOn(listId: string) {
    const { rows } = await db.pool.query<{ name: string }>(
      "SELECT name FROM item WHERE list_id = $1 ORDER BY name",
      [listId],
    );
    return rows.map(({ name }) => name);
  }

  it("deletes both checked items, returns their ids and keeps the unchecked one", async () => {
    const { app, as, list, bread, eggs } = await twoBoughtOneToBuy();

    const response = await as("POST", `/api/v1/lists/${list.id}/items/clear-checked`);

    expect(response.statusCode).toBe(200);
    const { deletedIds } = response.json<{ deletedIds: string[] }>();
    expect([...deletedIds].sort()).toEqual([bread.id, eggs.id].sort());
    expect(await namesOn(list.id)).toEqual(["Mleko"]);
    await app.close();
  });

  it("returns an empty deletedIds when nothing is checked", async () => {
    const { app, as, list } = await twoBoughtOneToBuy();
    await as("POST", `/api/v1/lists/${list.id}/items/clear-checked`);

    const response = await as("POST", `/api/v1/lists/${list.id}/items/clear-checked`);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ deletedIds: [] });
    expect(await namesOn(list.id)).toEqual(["Mleko"]);
    await app.close();
  });

  it("leaves checked items of other lists alone", async () => {
    const { app, ania, as, list } = await twoBoughtOneToBuy();
    const other = await createList(db.pool, ania);
    const butter = await createItem(db.pool, other, ania, "Masło");
    await as("PATCH", `/api/v1/lists/${other.id}/items/${butter.id}`, { checked: true });

    await as("POST", `/api/v1/lists/${list.id}/items/clear-checked`);

    expect(await namesOn(other.id)).toEqual(["Masło"]);
    await app.close();
  });
});
