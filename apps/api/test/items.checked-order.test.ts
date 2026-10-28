import { describe, expect, it } from "vitest";
import type { Item, ListDetails, ListSummary } from "@lista/shared";
import { buildTestApp } from "./app";
import { testClock } from "./clock";
import { useTestDatabase } from "./database";
import { createItem, createList, createUser } from "./factories";
import { requestsAs } from "./requests";

// AC2, AC7 (F-06, F-08): kupione pod nieodhaczonymi, od ostatnio odhaczonej; `toBuyCount`.
describe("checked items in list details and overview", () => {
  const db = useTestDatabase();

  async function shopping() {
    const clock = testClock("2026-10-28T10:00:00Z");
    const app = buildTestApp(db.pool, { clock });
    const ania = await createUser(app);
    const list = await createList(db.pool, ania);
    const milk = await createItem(db.pool, list, ania, "Mleko");
    const bread = await createItem(db.pool, list, ania, "Chleb");
    const eggs = await createItem(db.pool, list, ania, "Jajka");
    const as = requestsAs(app, ania);
    const check = async (itemId: string, at: string) => {
      clock.set(at);
      const response = await as("PATCH", `/api/v1/lists/${list.id}/items/${itemId}`, {
        checked: true,
      });
      expect(response.statusCode).toBe(200);
    };
    return { app, as, list, milk, bread, eggs, check };
  }

  it("lists unchecked items first, then checked from the most recently checked", async () => {
    const { app, as, list, milk, eggs, check } = await shopping();
    await check(milk.id, "2026-10-28T10:01:00Z");
    await check(eggs.id, "2026-10-28T10:02:00Z");

    const details = (await as("GET", `/api/v1/lists/${list.id}`)).json<ListDetails>();

    expect(details.items.map((item: Item) => [item.name, item.checked])).toEqual([
      ["Chleb", false],
      ["Jajka", true],
      ["Mleko", true],
    ]);
    expect(details.items[1]?.checkedAt).toBe("2026-10-28T10:02:00.000Z");
    await app.close();
  });

  it("counts only unchecked items in toBuyCount of GET /api/v1/lists", async () => {
    const { app, as, list, milk, bread, eggs, check } = await shopping();
    const toBuy = async () =>
      (await as("GET", "/api/v1/lists")).json<ListSummary[]>().find(({ id }) => id === list.id)
        ?.toBuyCount;

    expect(await toBuy()).toBe(3);
    await check(bread.id, "2026-10-28T10:01:00Z");
    expect(await toBuy()).toBe(2);
    await check(milk.id, "2026-10-28T10:02:00Z");
    await check(eggs.id, "2026-10-28T10:03:00Z");
    expect(await toBuy()).toBe(0);
    await app.close();
  });

  it("does not count items of other lists", async () => {
    const { app, as, list } = await shopping();
    const other = await createList(db.pool, { id: list.ownerId });
    await createItem(db.pool, other, null, "Masło");

    const lists = (await as("GET", "/api/v1/lists")).json<ListSummary[]>();

    expect(lists.map(({ id, toBuyCount }) => [id, toBuyCount])).toEqual([
      [other.id, 1],
      [list.id, 3],
    ]);
    await app.close();
  });
});
