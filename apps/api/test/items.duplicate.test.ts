import { describe, expect, it } from "vitest";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { createList, createUser } from "./factories";
import { requestsAs } from "./requests";

const DUPLICATE = { error: { code: "duplicate_item" } };

// AC2 (F-09, ADR 0004): duplikat nazwy bez rozróżniania wielkości liter, rozstrzyga baza.
describe("adding an item whose name is already on the list", () => {
  const db = useTestDatabase();

  async function listWithMilk() {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app);
    const list = await createList(db.pool, ania);
    const add = (name: string) =>
      requestsAs(app, ania)("POST", `/api/v1/lists/${list.id}/items`, { name });
    expect((await add("Mleko")).statusCode).toBe(201);
    return { app, list, add };
  }

  async function namesOn(listId: string) {
    const { rows } = await db.pool.query<{ name: string }>(
      "SELECT name FROM item WHERE list_id = $1 ORDER BY name",
      [listId],
    );
    return rows.map((row) => row.name);
  }

  it.each([
    ["other case", "mleko"],
    ["spaces at the edges and capitals", " MLEKO "],
    ["the same text", "Mleko"],
  ])("answers 409 duplicate_item for %s and adds nothing", async (_case, name) => {
    const { app, list, add } = await listWithMilk();

    const response = await add(name);

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual(DUPLICATE);
    expect(await namesOn(list.id)).toEqual(["Mleko"]);
    await app.close();
  });

  it("treats another Unicode form of the same name as a duplicate (NFC)", async () => {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app);
    const list = await createList(db.pool, ania);
    const add = (name: string) =>
      requestsAs(app, ania)("POST", `/api/v1/lists/${list.id}/items`, { name });
    await add("Żółty ser");

    const response = await add("Żółty SER");

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual(DUPLICATE);
    await app.close();
  });

  it("blocks a duplicate of a checked item too (F-09)", async () => {
    const { app, list, add } = await listWithMilk();
    await db.pool.query("UPDATE item SET checked_at = now() WHERE list_id = $1", [list.id]);

    const response = await add("mleko");

    expect(response.statusCode).toBe(409);
    await app.close();
  });

  it("adds „Mleko owsiane” next to „Mleko” without a warning", async () => {
    const { app, list, add } = await listWithMilk();

    const response = await add("Mleko owsiane");

    expect(response.statusCode).toBe(201);
    expect(await namesOn(list.id)).toEqual(["Mleko", "Mleko owsiane"]);
    await app.close();
  });

  it("allows the same name on another list", async () => {
    const { app } = await listWithMilk();
    const tomek = await createUser(app);
    const other = await createList(db.pool, tomek);

    const response = await requestsAs(app, tomek)("POST", `/api/v1/lists/${other.id}/items`, {
      name: "Mleko",
    });

    expect(response.statusCode).toBe(201);
    await app.close();
  });
});
