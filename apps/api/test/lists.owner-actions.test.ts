import type { ListSummary } from "@lista/shared";
import { describe, expect, it } from "vitest";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { addMember, createList, createUser } from "./factories";
import { requestsAs } from "./requests";

// AC6 (F-05): właściciel zmienia nazwę i usuwa listę; usunięcie zabiera członkostwa.
describe("owner renames and deletes a list", () => {
  const db = useTestDatabase();

  it("renames the list, trims the name and moves the list to the top", async () => {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app, { name: "Ania" });
    const renamed = await createList(db.pool, ania, "Stara nazwa");
    await createList(db.pool, ania, "Inna");
    const asAnia = requestsAs(app, ania);

    const response = await asAnia("PATCH", `/api/v1/lists/${renamed.id}`, {
      name: "  Nowa nazwa  ",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<ListSummary>()).toMatchObject({
      id: renamed.id,
      name: "Nowa nazwa",
      role: "owner",
    });
    const lists = (await asAnia("GET", "/api/v1/lists")).json<ListSummary[]>();
    expect(lists.map((list) => list.name)).toEqual(["Nowa nazwa", "Inna"]);
    await app.close();
  });

  it("deletes the list with its memberships and answers 204", async () => {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app);
    const tomek = await createUser(app);
    const list = await createList(db.pool, ania);
    await addMember(db.pool, list, tomek);

    const response = await requestsAs(app, ania)("DELETE", `/api/v1/lists/${list.id}`);

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe("");
    expect((await requestsAs(app, ania)("GET", "/api/v1/lists")).json()).toEqual([]);
    expect((await requestsAs(app, tomek)("GET", "/api/v1/lists")).json()).toEqual([]);
    const { rows } = await db.pool.query("SELECT 1 FROM list_member WHERE list_id = $1", [list.id]);
    expect(rows).toEqual([]);
    const people = await db.pool.query(`SELECT 1 FROM "user"`);
    expect(people.rows).toHaveLength(2);
    await app.close();
  });
});
