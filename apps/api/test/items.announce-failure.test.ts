import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { expectOneAnnounceFailure, failingLive } from "./failing-live";
import { createItem, createList, createUser } from "./factories";
import { captureLogs } from "./logs";
import { requestsAs } from "./requests";

// T-089 AC1 (F-14): zmiana pozycji jest już zatwierdzona, więc błąd rozesłania zdarzeń na żywo
// trafia tylko do logu, a odpowiedź oddaje wynik zapisu.
describe("item routes when the live announcement fails", () => {
  const db = useTestDatabase();

  async function setUp() {
    const logs = captureLogs();
    const live = failingLive("publish", "notify");
    const app = buildTestApp(db.pool, { live, logger: { level: "info", stream: logs.stream } });
    const ania = await createUser(app, { name: "Ania" });
    const list = await createList(db.pool, ania, "Działka");
    const milk = await createItem(db.pool, list, ania, "Mleko");
    const asAnia = requestsAs(app, ania);
    const itemNames = async () =>
      (await asAnia("GET", `/api/v1/lists/${list.id}`))
        .json<{ items: { name: string; checked: boolean }[] }>()
        .items.map(({ name, checked }) => ({ name, checked }));
    const personal = ["Ania", "Działka", "Mleko", ania.email];
    return { app, logs, asAnia, list, milk, itemNames, personal };
  }

  it("POST /api/v1/lists/:listId/items answers 201 and the item is saved", async () => {
    const { app, logs, asAnia, list, itemNames, personal } = await setUp();

    const response = await asAnia("POST", `/api/v1/lists/${list.id}/items`, {
      id: randomUUID(),
      name: "Chleb",
    });

    expect(response.statusCode).toBe(201);
    expect(await itemNames()).toContainEqual({ name: "Chleb", checked: false });
    expectOneAnnounceFailure(logs, [...personal, "Chleb"]);
    await app.close();
  });

  it("PATCH /api/v1/lists/:listId/items/:itemId answers 200 and the change is saved", async () => {
    const { app, logs, asAnia, list, milk, itemNames, personal } = await setUp();

    const response = await asAnia("PATCH", `/api/v1/lists/${list.id}/items/${milk.id}`, {
      checked: true,
    });

    expect(response.statusCode).toBe(200);
    expect(await itemNames()).toEqual([{ name: "Mleko", checked: true }]);
    expectOneAnnounceFailure(logs, personal);
    await app.close();
  });

  it("POST /api/v1/lists/:listId/items/clear-checked answers 200 with the deleted ids", async () => {
    const { app, logs, asAnia, list, milk, itemNames, personal } = await setUp();
    await db.pool.query("UPDATE item SET checked_at = now() WHERE id = $1", [milk.id]);

    const response = await asAnia("POST", `/api/v1/lists/${list.id}/items/clear-checked`);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ deletedIds: [milk.id] });
    expect(await itemNames()).toEqual([]);
    expectOneAnnounceFailure(logs, personal);
    await app.close();
  });

  it("DELETE /api/v1/lists/:listId/items/:itemId answers 204 and the item is deleted", async () => {
    const { app, logs, asAnia, list, milk, itemNames, personal } = await setUp();

    const response = await asAnia("DELETE", `/api/v1/lists/${list.id}/items/${milk.id}`);

    expect(response.statusCode).toBe(204);
    expect(await itemNames()).toEqual([]);
    expectOneAnnounceFailure(logs, personal);
    await app.close();
  });
});
