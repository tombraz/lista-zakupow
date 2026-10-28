import { describe, expect, it } from "vitest";
import { buildTestApp } from "./app";
import { testClock } from "./clock";
import { useTestDatabase } from "./database";
import { addMember, createItem, createList, createUser } from "./factories";
import { requestsAs } from "./requests";

// AC6 (BRD §10): odhaczenia zapisują aktywność dzienną (lista, dzień, domownik).
describe("daily list activity (module statystyki)", () => {
  const db = useTestDatabase();

  async function shopping() {
    const clock = testClock("2026-10-28T09:00:00Z");
    const app = buildTestApp(db.pool, { clock });
    const ania = await createUser(app);
    const list = await createList(db.pool, ania);
    const items = [
      await createItem(db.pool, list, ania, "Mleko"),
      await createItem(db.pool, list, ania, "Chleb"),
      await createItem(db.pool, list, ania, "Jajka"),
    ];
    const check = (itemId: string, checked: boolean, as = ania) =>
      requestsAs(app, as)("PATCH", `/api/v1/lists/${list.id}/items/${itemId}`, { checked });
    return { app, clock, ania, list, items, check };
  }

  async function activity() {
    const { rows } = await db.pool.query<{
      list_id: string;
      day: string;
      user_id: string;
      checks: number;
    }>(
      "SELECT list_id, to_char(day, 'YYYY-MM-DD') AS day, user_id, checks FROM list_daily_activity ORDER BY day, user_id",
    );
    return rows;
  }

  it("keeps one row (list, day, household member) with checks = 3 after three checks", async () => {
    const { app, ania, list, items, check } = await shopping();

    for (const { id } of items) expect((await check(id, true)).statusCode).toBe(200);

    expect(await activity()).toEqual([
      { list_id: list.id, day: "2026-10-28", user_id: ania.id, checks: 3 },
    ]);
    await app.close();
  });

  it("does not decrease the counter on uncheck nor count a repeated check", async () => {
    const { app, ania, list, items, check } = await shopping();
    const [milk] = items;
    if (!milk) throw new Error("no item");

    await check(milk.id, true);
    await check(milk.id, true);
    await check(milk.id, false);

    expect(await activity()).toEqual([
      { list_id: list.id, day: "2026-10-28", user_id: ania.id, checks: 1 },
    ]);
    await app.close();
  });

  it("starts a new row on the next day and a separate row per household member", async () => {
    const { app, clock, ania, list, items, check } = await shopping();
    const [milk, bread, eggs] = items;
    if (!milk || !bread || !eggs) throw new Error("no items");
    const tomek = await createUser(app);
    await addMember(db.pool, list, tomek);

    await check(milk.id, true);
    await check(bread.id, true, tomek);
    clock.set("2026-10-29T09:00:00Z");
    await check(eggs.id, true);

    const rows = await activity();
    expect(rows).toHaveLength(3);
    expect(rows).toContainEqual({
      list_id: list.id,
      day: "2026-10-28",
      user_id: ania.id,
      checks: 1,
    });
    expect(rows).toContainEqual({
      list_id: list.id,
      day: "2026-10-28",
      user_id: tomek.id,
      checks: 1,
    });
    expect(rows).toContainEqual({
      list_id: list.id,
      day: "2026-10-29",
      user_id: ania.id,
      checks: 1,
    });
    await app.close();
  });

  it("counts the day in Europe/Warsaw: 23:30 UTC on 28 Oct is already 29 Oct", async () => {
    const { app, clock, ania, list, items, check } = await shopping();
    const [milk] = items;
    if (!milk) throw new Error("no item");
    clock.set("2026-10-28T23:30:00Z");

    await check(milk.id, true);

    expect(await activity()).toEqual([
      { list_id: list.id, day: "2026-10-29", user_id: ania.id, checks: 1 },
    ]);
    await app.close();
  });
});
