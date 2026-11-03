import type { Item, ListSummary } from "@lista/shared";
import { describe, expect, it } from "vitest";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { addMember, createItem, createList, createUser } from "./factories";
import { requestsAs } from "./requests";

// T-062 SEC3 (TH-18): usunięcie konta nie rusza cudzych list, pozycji ani członkostw.
describe("DELETE /api/v1/me leaves other people's data alone", () => {
  const db = useTestDatabase();

  it("keeps others' lists, items (also those the account checked) and memberships outside its lists", async () => {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app, { name: "Ania" });
    const tomek = await createUser(app, { name: "Tomek" });
    const ola = await createUser(app, { name: "Ola" });
    const asTomek = requestsAs(app, tomek);
    const asOla = requestsAs(app, ola);
    // Lista Tomka z Anią: pozycja Tomka odhaczona przez Anię.
    const tomeks = await createList(db.pool, tomek, "Tomka");
    await addMember(db.pool, tomeks, ania);
    await addMember(db.pool, tomeks, ola);
    const bread = await asTomek("POST", `/api/v1/lists/${tomeks.id}/items`, { name: "Chleb" });
    const breadId = bread.json<Item>().id;
    const checked = await requestsAs(app, ania)(
      "PATCH",
      `/api/v1/lists/${tomeks.id}/items/${breadId}`,
      { checked: true },
    );
    expect([bread.statusCode, checked.statusCode]).toEqual([201, 200]);
    // Lista Oli bez Ani, z Tomkiem; pozycje i odhaczenie Oli.
    const olas = await createList(db.pool, ola, "Oli");
    await addMember(db.pool, olas, tomek);
    const milk = await asOla("POST", `/api/v1/lists/${olas.id}/items`, { name: "Mleko" });
    const milkId = milk.json<Item>().id;
    await asOla("PATCH", `/api/v1/lists/${olas.id}/items/${milkId}`, { checked: true });
    await createItem(db.pool, olas, tomek, "Jajka");
    const before = {
      olas: (await asOla("GET", `/api/v1/lists/${olas.id}`)).json<{ items: Item[] }>(),
      activity: (
        await db.pool.query("SELECT * FROM list_daily_activity WHERE user_id <> $1", [ania.id])
      ).rows,
    };

    const response = await requestsAs(app, ania)("DELETE", "/api/v1/me", { confirm: true });

    expect(response.statusCode).toBe(204);
    const tomekLists = (await asTomek("GET", "/api/v1/lists")).json<ListSummary[]>();
    const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
    expect(tomekLists.map(({ id, name, members }) => ({ id, name, members })).sort(byName)).toEqual(
      [
        { id: olas.id, name: "Oli", members: [{ id: tomek.id, name: "Tomek" }] },
        { id: tomeks.id, name: "Tomka", members: [{ id: ola.id, name: "Ola" }] },
      ],
    );
    const tomekItems = (await asTomek("GET", `/api/v1/lists/${tomeks.id}`)).json<{
      items: Item[];
    }>().items;
    expect(tomekItems).toMatchObject([
      {
        id: breadId,
        name: "Chleb",
        addedBy: { id: tomek.id, name: "Tomek" },
        checked: true,
        checkedBy: null,
      },
    ]);
    expect((await asOla("GET", `/api/v1/lists/${olas.id}`)).json<{ items: Item[] }>()).toEqual(
      before.olas,
    );
    expect(
      (await db.pool.query("SELECT * FROM list_daily_activity WHERE user_id <> $1", [ania.id]))
        .rows,
    ).toEqual(before.activity);
    expect((await asTomek("GET", "/api/v1/me")).statusCode).toBe(200);
    expect((await asOla("GET", "/api/v1/me")).statusCode).toBe(200);
    await app.close();
  });
});
