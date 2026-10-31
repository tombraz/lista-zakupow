import { describe, expect, it } from "vitest";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { addMember, createList, createUser } from "./factories";
import { requestsAs } from "./requests";

// AC7, AC6 (F-05): szczegóły listy z pozycjami; pozycje dochodzą w T-006.
describe("GET /api/v1/lists/:listId", () => {
  const db = useTestDatabase();

  it("gives an own list without items as items: []", async () => {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app, { name: "Ania" });
    const tomek = await createUser(app, { name: "Tomek" });
    const list = await createList(db.pool, ania, "Dom");
    await addMember(db.pool, list, tomek);

    const response = await requestsAs(app, ania)("GET", `/api/v1/lists/${list.id}`);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: list.id,
      name: "Dom",
      role: "owner",
      owner: { id: ania.id, name: "Ania" },
      members: [{ id: tomek.id, name: "Tomek" }],
      items: [],
    });
    await app.close();
  });

  it("gives a participant the list with role participant", async () => {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app);
    const tomek = await createUser(app);
    const list = await createList(db.pool, ania);
    await addMember(db.pool, list, tomek);

    const response = await requestsAs(app, tomek)("GET", `/api/v1/lists/${list.id}`);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: list.id, role: "participant" });
    await app.close();
  });

  it("shows the new name after the owner renamed the list", async () => {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app);
    const list = await createList(db.pool, ania, "Stara");
    const asAnia = requestsAs(app, ania);

    await asAnia("PATCH", `/api/v1/lists/${list.id}`, { name: "Nowa" });
    const response = await asAnia("GET", `/api/v1/lists/${list.id}`);

    expect(response.json()).toMatchObject({ name: "Nowa" });
    await app.close();
  });
});
