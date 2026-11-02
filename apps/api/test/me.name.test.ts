import type { Item, ListMembers, ListSummary } from "@lista/shared";
import { describe, expect, it } from "vitest";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { addMember, createList, createUser } from "./factories";
import { requestsAs } from "./requests";

// T-061 AC1 (F-16): domownik zmienia imię widoczne dla innych.
describe("PATCH /api/v1/me", () => {
  const db = useTestDatabase();

  it("answers 200 with the trimmed name, and me, lists, members and items show it", async () => {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app, { name: "Ania" });
    const tomek = await createUser(app, { name: "Tomek" });
    const home = await createList(db.pool, ania, "Dom");
    await addMember(db.pool, home, tomek);
    const own = await createList(db.pool, tomek, "Działka");
    const asTomek = requestsAs(app, tomek);
    const added = await asTomek("POST", `/api/v1/lists/${home.id}/items`, { name: "Mleko" });
    const checked = await asTomek(
      "PATCH",
      `/api/v1/lists/${home.id}/items/${added.json<Item>().id}`,
      {
        checked: true,
      },
    );
    expect([added.statusCode, checked.statusCode]).toEqual([201, 200]);

    const response = await asTomek("PATCH", "/api/v1/me", { name: " Tomasz " });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ id: tomek.id, name: "Tomasz", email: tomek.email });
    expect((await asTomek("GET", "/api/v1/me")).json()).toEqual({
      id: tomek.id,
      name: "Tomasz",
      email: tomek.email,
    });
    const asAnia = requestsAs(app, ania);
    const anias = (await asAnia("GET", "/api/v1/lists")).json<ListSummary[]>();
    expect(anias.find((list) => list.id === home.id)?.members).toEqual([
      { id: tomek.id, name: "Tomasz" },
    ]);
    const tomeks = (await asTomek("GET", "/api/v1/lists")).json<ListSummary[]>();
    expect(tomeks.find((list) => list.id === own.id)?.owner).toEqual({
      id: tomek.id,
      name: "Tomasz",
    });
    const members = (await asAnia("GET", `/api/v1/lists/${home.id}/members`)).json<ListMembers>();
    expect(members.participants).toEqual([{ id: tomek.id, name: "Tomasz", email: tomek.email }]);
    const [milk] = (await asAnia("GET", `/api/v1/lists/${home.id}`)).json<{ items: Item[] }>()
      .items;
    expect(milk?.addedBy).toEqual({ id: tomek.id, name: "Tomasz" });
    expect(milk?.checkedBy).toEqual({ id: tomek.id, name: "Tomasz" });
    await app.close();
  });

  // Client state during writes: ponowienie utraconej odpowiedzi tym samym imieniem.
  it("answers 200 again when the same name is sent twice", async () => {
    const app = buildTestApp(db.pool);
    const tomek = await createUser(app, { name: "Tomek" });
    const asTomek = requestsAs(app, tomek);

    await asTomek("PATCH", "/api/v1/me", { name: "Tomasz" });
    const again = await asTomek("PATCH", "/api/v1/me", { name: "Tomasz" });

    expect(again.statusCode).toBe(200);
    expect(again.json()).toEqual({ id: tomek.id, name: "Tomasz", email: tomek.email });
    await app.close();
  });
});
