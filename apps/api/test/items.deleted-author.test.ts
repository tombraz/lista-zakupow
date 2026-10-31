import { describe, expect, it } from "vitest";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { addMember, createItem, createList, createUser } from "./factories";
import { requestsAs } from "./requests";

// AC8 (F-10, data-model.md): usunięty autor = `addedBy: null` („usunięty użytkownik”).
describe("an item whose author no longer exists", () => {
  const db = useTestDatabase();

  it("gives addedBy: null for a row with added_by NULL", async () => {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app);
    const list = await createList(db.pool, ania);
    await createItem(db.pool, list, null, "Mleko");

    const response = await requestsAs(app, ania)("GET", `/api/v1/lists/${list.id}`);

    expect(response.json()).toMatchObject({ items: [{ name: "Mleko", addedBy: null }] });
    await app.close();
  });

  it("keeps the item of a deleted participant on the list without an author (SET NULL)", async () => {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app);
    const tomek = await createUser(app);
    const list = await createList(db.pool, ania);
    await addMember(db.pool, list, tomek);
    await createItem(db.pool, list, tomek, "Chleb");

    await db.pool.query(`DELETE FROM "user" WHERE id = $1`, [tomek.id]);
    const response = await requestsAs(app, ania)("GET", `/api/v1/lists/${list.id}`);

    expect(response.json()).toMatchObject({ items: [{ name: "Chleb", addedBy: null }] });
    await app.close();
  });
});
