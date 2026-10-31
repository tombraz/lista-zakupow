import { describe, expect, it } from "vitest";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { addMember, createItem, createList, createUser } from "./factories";
import { requestsAs } from "./requests";

const NOT_FOUND = { error: { code: "not_found" } };

// AC7 (F-07, F-14): usunięcie pozycji; usunięcie wygrywa z równoczesną edycją.
describe("DELETE /api/v1/lists/:listId/items/:itemId", () => {
  const db = useTestDatabase();

  async function setUp() {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app);
    const tomek = await createUser(app);
    const list = await createList(db.pool, ania);
    await addMember(db.pool, list, tomek);
    const milk = await createItem(db.pool, list, ania, "Mleko");
    const bread = await createItem(db.pool, list, ania, "Chleb");
    const url = `/api/v1/lists/${list.id}/items/${milk.id}`;
    return { app, ania, tomek, list, milk, bread, url };
  }

  it("deletes the item with 204; it is gone from the list (AC7)", async () => {
    const { app, ania, list, bread, url } = await setUp();
    const asAnia = requestsAs(app, ania);

    const response = await asAnia("DELETE", url);

    expect(response.statusCode).toBe(204);
    const details = await asAnia("GET", `/api/v1/lists/${list.id}`);
    expect(details.json<{ items: { id: string }[] }>().items.map((item) => item.id)).toEqual([
      bread.id,
    ]);
    await app.close();
  });

  it("lets a participant delete an item added by the owner (F-07)", async () => {
    const { app, tomek, url } = await setUp();

    expect((await requestsAs(app, tomek)("DELETE", url)).statusCode).toBe(204);
    await app.close();
  });

  it("answers 404 when the item was already deleted by someone else", async () => {
    const { app, ania, tomek, url } = await setUp();
    await requestsAs(app, tomek)("DELETE", url);

    const response = await requestsAs(app, ania)("DELETE", url);

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(NOT_FOUND);
    await app.close();
  });

  it("answers an edit of a deleted item with 404 and does not bring it back (AC7, F-14)", async () => {
    const { app, ania, tomek, list, url } = await setUp();
    await requestsAs(app, tomek)("DELETE", url);

    const response = await requestsAs(app, ania)("PATCH", url, { note: "2 l" });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(NOT_FOUND);
    const { rows } = await db.pool.query("SELECT name FROM item WHERE list_id = $1", [list.id]);
    expect(rows).toEqual([{ name: "Chleb" }]);
    await app.close();
  });

  it("answers 404 for an item id that is not a UUID", async () => {
    const { app, ania, list } = await setUp();
    const asAnia = requestsAs(app, ania);

    for (const method of ["PATCH", "DELETE"] as const) {
      const response = await asAnia(method, `/api/v1/lists/${list.id}/items/abc`, { note: "x" });
      expect(response.statusCode).toBe(404);
    }
    await app.close();
  });
});
