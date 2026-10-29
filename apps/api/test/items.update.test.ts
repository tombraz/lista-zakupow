import { describe, expect, it } from "vitest";
import { buildTestApp } from "./app";
import { testClock } from "./clock";
import { useTestDatabase } from "./database";
import { addMember, createItem, createList, createUser } from "./factories";
import { requestsAs } from "./requests";

// AC3 (F-07, F-09): edycja nazwy i notatki; pozycja nie jest duplikatem samej siebie.
describe("PATCH /api/v1/lists/:listId/items/:itemId", () => {
  const db = useTestDatabase();

  async function milkAndButter() {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app);
    const list = await createList(db.pool, ania);
    const milk = await createItem(db.pool, list, ania, "Mleko");
    const butter = await createItem(db.pool, list, ania, "Masło");
    const patch = (itemId: string, body: object, as = ania) =>
      requestsAs(app, as)("PATCH", `/api/v1/lists/${list.id}/items/${itemId}`, body);
    return { app, ania, list, milk, butter, patch };
  }

  async function stored(itemId: string) {
    const { rows } = await db.pool.query<{ name: string; note: string | null }>(
      "SELECT name, note FROM item WHERE id = $1",
      [itemId],
    );
    return rows[0];
  }

  it("refuses to rename „Masło” to „mleko” with 409 duplicate_item and keeps the name", async () => {
    const { app, butter, patch } = await milkAndButter();

    const response = await patch(butter.id, { name: "mleko" });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: { code: "duplicate_item" } });
    expect(await stored(butter.id)).toEqual({ name: "Masło", note: null });
    await app.close();
  });

  it("renames „Mleko” to „mleko” — the item is not a duplicate of itself", async () => {
    const { app, milk, patch } = await milkAndButter();

    const response = await patch(milk.id, { name: "mleko" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: milk.id, name: "mleko" });
    expect(await stored(milk.id)).toEqual({ name: "mleko", note: null });
    await app.close();
  });

  it("changes only the note and clears it with an empty one", async () => {
    const { app, butter, patch } = await milkAndButter();

    const changed = await patch(butter.id, { note: "kostka 200 g" });
    expect(changed.statusCode).toBe(200);
    expect(changed.json()).toMatchObject({ name: "Masło", note: "kostka 200 g" });

    const cleared = await patch(butter.id, { note: "" });
    expect(cleared.json()).toMatchObject({ name: "Masło", note: null });
    expect(await stored(butter.id)).toEqual({ name: "Masło", note: null });
    await app.close();
  });

  it("lets a participant edit with the same rights as the owner (F-07)", async () => {
    const { app, list, milk, patch } = await milkAndButter();
    const tomek = await createUser(app);
    await addMember(db.pool, list, tomek);

    const response = await patch(milk.id, { name: "Mleko 3,2 %" }, tomek);

    expect(response.statusCode).toBe(200);
    expect(await stored(milk.id)).toEqual({ name: "Mleko 3,2 %", note: null });
    await app.close();
  });

  // T-017 (api.md, „Konwencje” db.md): jeden zegar `updatedAt` dla edycji i odhaczenia.
  it("stamps updatedAt of an edit with the app clock, as a check does", async () => {
    const clock = testClock("2026-10-28T10:00:00Z");
    const app = buildTestApp(db.pool, { clock });
    const ania = await createUser(app);
    const list = await createList(db.pool, ania);
    const milk = await createItem(db.pool, list, ania, "Mleko");
    const patch = (body: object) =>
      requestsAs(app, ania)("PATCH", `/api/v1/lists/${list.id}/items/${milk.id}`, body);

    clock.set("2026-10-28T10:05:00Z");
    const edited = await patch({ note: "2 l" });
    clock.set("2026-10-28T10:06:00Z");
    const checked = await patch({ checked: true });

    expect(edited.json()).toMatchObject({ updatedAt: "2026-10-28T10:05:00.000Z" });
    expect(checked.json()).toMatchObject({ updatedAt: "2026-10-28T10:06:00.000Z" });
    await app.close();
  });

  it("stamps createdAt and updatedAt of a new item with the app clock", async () => {
    const clock = testClock("2026-10-28T10:00:00Z");
    const app = buildTestApp(db.pool, { clock });
    const ania = await createUser(app);
    const list = await createList(db.pool, ania);

    clock.set("2026-10-28T09:00:00Z");
    const added = await requestsAs(app, ania)("POST", `/api/v1/lists/${list.id}/items`, {
      name: "Mleko",
    });

    expect(added.json()).toMatchObject({
      createdAt: "2026-10-28T09:00:00.000Z",
      updatedAt: "2026-10-28T09:00:00.000Z",
    });
    await app.close();
  });
});
