import { describe, expect, it } from "vitest";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { addMember, createItem, createList, createUser } from "./factories";
import { requestsAs } from "./requests";

// AC1 (F-08, F-10): odhaczenie zapisuje, kto i kiedy kupił; odznaczenie to czyści.
describe("PATCH /api/v1/lists/:listId/items/:itemId { checked }", () => {
  const db = useTestDatabase();

  async function breadOnList() {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app, { name: "Ania" });
    const tomek = await createUser(app, { name: "Tomek" });
    const list = await createList(db.pool, ania);
    await addMember(db.pool, list, tomek);
    const bread = await createItem(db.pool, list, ania, "Chleb");
    const check = (checked: boolean, as = tomek) =>
      requestsAs(app, as)("PATCH", `/api/v1/lists/${list.id}/items/${bread.id}`, { checked });
    return { app, ania, tomek, list, bread, check };
  }

  async function stored(itemId: string) {
    const { rows } = await db.pool.query<{ checked_by: string | null; checked: boolean }>(
      "SELECT checked_by, checked_at IS NOT NULL AS checked FROM item WHERE id = $1",
      [itemId],
    );
    return rows[0];
  }

  it("checks an item: 200 with checked, checkedBy { id, name } and checkedAt", async () => {
    const { app, tomek, bread, check } = await breadOnList();

    const response = await check(true);

    expect(response.statusCode).toBe(200);
    const body = response.json<Record<string, unknown>>();
    expect(body).toMatchObject({
      id: bread.id,
      name: "Chleb",
      checked: true,
      checkedBy: { id: tomek.id, name: "Tomek" },
    });
    expect(body.checkedBy).toEqual({ id: tomek.id, name: "Tomek" });
    expect(typeof body.checkedAt).toBe("string");
    expect(Number.isNaN(Date.parse(String(body.checkedAt)))).toBe(false);
    expect(await stored(bread.id)).toEqual({ checked_by: tomek.id, checked: true });
    await app.close();
  });

  it("unchecks a checked item: checked false, checkedBy and checkedAt null", async () => {
    const { app, ania, bread, check } = await breadOnList();
    await check(true);

    const response = await check(false, ania);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: bread.id,
      checked: false,
      checkedBy: null,
      checkedAt: null,
      addedBy: { id: ania.id, name: "Ania" },
    });
    expect(await stored(bread.id)).toEqual({ checked_by: null, checked: false });
    await app.close();
  });

  it("rejects a non-boolean checked with 400 validation_failed", async () => {
    const { app, list, bread, tomek } = await breadOnList();

    const response = await requestsAs(app, tomek)(
      "PATCH",
      `/api/v1/lists/${list.id}/items/${bread.id}`,
      { checked: "yes" },
    );

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: "validation_failed" } });
    expect(await stored(bread.id)).toEqual({ checked_by: null, checked: false });
    await app.close();
  });
});
