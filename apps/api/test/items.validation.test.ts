import { describe, expect, it } from "vitest";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { createItem, createList, createUser } from "./factories";
import { requestsAs } from "./requests";

const invalid = (fields: object) => ({ error: { code: "validation_failed", fields } });

// AC4, SEC3 (F-07, TH-13): długości nazwy i notatki, limit treści żądania.
describe("item name and note lengths", () => {
  const db = useTestDatabase();

  async function setUp() {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app);
    const list = await createList(db.pool, ania);
    const milk = await createItem(db.pool, list, ania, "Mleko");
    const asAnia = requestsAs(app, ania);
    return {
      app,
      add: (body: object) => asAnia("POST", `/api/v1/lists/${list.id}/items`, body),
      edit: (body: object) => asAnia("PATCH", `/api/v1/lists/${list.id}/items/${milk.id}`, body),
      milk,
    };
  }

  it.each([
    [{ name: "" }, { name: "required" }],
    [{ name: "a".repeat(101) }, { name: "too_long" }],
    [{ name: "Chleb", note: "n".repeat(201) }, { note: "too_long" }],
  ])("refuses to add %o with 400 and the field (AC4)", async (body, fields) => {
    const { app, add } = await setUp();

    const response = await add(body);

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual(invalid(fields));
    await app.close();
  });

  it.each([
    [{ name: "  " }, { name: "required" }],
    [{ name: "a".repeat(101) }, { name: "too_long" }],
    [{ note: "n".repeat(201) }, { note: "too_long" }],
  ])("refuses to change the item to %o with 400 and keeps it (AC4)", async (body, fields) => {
    const { app, edit, milk } = await setUp();

    const response = await edit(body);

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual(invalid(fields));
    const { rows } = await db.pool.query("SELECT name, note FROM item WHERE id = $1", [milk.id]);
    expect(rows).toEqual([{ name: "Mleko", note: null }]);
    await app.close();
  });

  it("accepts exactly 100 characters of name and 200 of note", async () => {
    const { app, add } = await setUp();

    const response = await add({ name: "a".repeat(100), note: "n".repeat(200) });

    expect(response.statusCode).toBe(201);
    await app.close();
  });

  it("answers 413 for a note far beyond the request size limit (SEC3)", async () => {
    const { app, add } = await setUp();

    const response = await add({ name: "Spam", note: "n".repeat(20_000) });

    expect(response.statusCode).toBe(413);
    await app.close();
  });
});
