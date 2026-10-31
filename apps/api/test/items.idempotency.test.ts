import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { createList, createUser } from "./factories";
import { requestsAs } from "./requests";

// AC6 (F-15, architecture.md „Konwencje API”): ponowione dodanie z tym samym `id` klienta.
describe("adding an item with the client's id", () => {
  const db = useTestDatabase();

  async function itemCount(listId: string) {
    const { rows } = await db.pool.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM item WHERE list_id = $1",
      [listId],
    );
    return rows[0]?.count;
  }

  it("creates the item under that id, then answers a repeat with 200 and the same item", async () => {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app);
    const list = await createList(db.pool, ania);
    const add = () =>
      requestsAs(app, ania)("POST", `/api/v1/lists/${list.id}/items`, { id, name: "Mleko" });
    const id = randomUUID();

    const first = await add();
    const repeat = await add();

    expect(first.statusCode).toBe(201);
    expect(first.json()).toMatchObject({ id, name: "Mleko" });
    expect(repeat.statusCode).toBe(200);
    expect(repeat.json()).toEqual(first.json());
    expect(await itemCount(list.id)).toBe(1);
    await app.close();
  });

  it("does not let the id of an item on someone else's list reveal or change it (TH-01)", async () => {
    const app = buildTestApp(db.pool);
    const [ania, bartek] = [await createUser(app), await createUser(app)];
    const listA = await createList(db.pool, ania);
    const listB = await createList(db.pool, bartek);
    const id = randomUUID();
    await requestsAs(app, ania)("POST", `/api/v1/lists/${listA.id}/items`, { id, name: "Tajne" });

    const response = await requestsAs(app, bartek)("POST", `/api/v1/lists/${listB.id}/items`, {
      id,
      name: "Mleko",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: { code: "not_found" } });
    expect(response.body).not.toContain("Tajne");
    expect(await itemCount(listA.id)).toBe(1);
    expect(await itemCount(listB.id)).toBe(0);
    await app.close();
  });
});
