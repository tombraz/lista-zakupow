import type { Item } from "@lista/shared";
import { describe, expect, it } from "vitest";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { addMember, createItem, createList, createUser } from "./factories";
import { requestsAs } from "./requests";

// T-059 AC1 (F-13): uczestnik opuszcza listę.
describe("POST /api/v1/lists/:listId/leave", () => {
  const db = useTestDatabase();

  it("answers 204, removes the membership and keeps the items the participant added and checked", async () => {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app, { name: "Ania" });
    const tomek = await createUser(app, { name: "Tomek" });
    const ola = await createUser(app, { name: "Ola" });
    const list = await createList(db.pool, ania, "Dom");
    await addMember(db.pool, list, tomek);
    await addMember(db.pool, list, ola);
    const asTomek = requestsAs(app, tomek);
    const added = await asTomek("POST", `/api/v1/lists/${list.id}/items`, { name: "Mleko" });
    const bread = await createItem(db.pool, list, ania, "Chleb");
    const checked = await asTomek("PATCH", `/api/v1/lists/${list.id}/items/${bread.id}`, {
      checked: true,
    });
    expect([added.statusCode, checked.statusCode]).toEqual([201, 200]);

    const response = await asTomek("POST", `/api/v1/lists/${list.id}/leave`);

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe("");
    const asAnia = requestsAs(app, ania);
    const members = await asAnia("GET", `/api/v1/lists/${list.id}/members`);
    expect(members.json()).toEqual({
      owner: { id: ania.id, name: "Ania" },
      participants: [{ id: ola.id, name: "Ola", email: ola.email }],
    });
    const items = (await asAnia("GET", `/api/v1/lists/${list.id}`)).json<{ items: Item[] }>().items;
    expect(items.find((item) => item.name === "Mleko")?.addedBy).toEqual({
      id: tomek.id,
      name: "Tomek",
    });
    expect(items.find((item) => item.name === "Chleb")?.checkedBy).toEqual({
      id: tomek.id,
      name: "Tomek",
    });
    expect((await asTomek("GET", "/api/v1/lists")).json()).toEqual([]);
    await app.close();
  });
});
