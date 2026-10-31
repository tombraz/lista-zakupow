import type { Item } from "@lista/shared";
import { describe, expect, it } from "vitest";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { addMember, createList, createUser } from "./factories";
import { requestsAs } from "./requests";

const ISO_DATE = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// AC1, SEC2 (F-07, F-10, TH-19): dodanie pozycji przez właściciela lub uczestnika.
describe("POST /api/v1/lists/:listId/items", () => {
  const db = useTestDatabase();

  it("adds an unchecked item signed with the author's name and nothing more (AC1, SEC2)", async () => {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app, { name: "Ania" });
    const list = await createList(db.pool, ania);

    const response = await requestsAs(app, ania)("POST", `/api/v1/lists/${list.id}/items`, {
      name: "  Mleko ",
      note: "2 l",
    });

    expect(response.statusCode).toBe(201);
    const { id, createdAt, updatedAt, ...item } = response.json<Item>();
    expect(id).toMatch(UUID);
    expect(createdAt).toMatch(ISO_DATE);
    expect(updatedAt).toMatch(ISO_DATE);
    expect(item).toEqual({
      name: "Mleko",
      note: "2 l",
      addedBy: { id: ania.id, name: "Ania" },
      checked: false,
      checkedBy: null,
      checkedAt: null,
    });
    expect(response.body).not.toContain(ania.email);
    await app.close();
  });

  it("lets a participant add an item with the same rights as the owner (AC1)", async () => {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app);
    const tomek = await createUser(app, { name: "Tomek" });
    const list = await createList(db.pool, ania);
    await addMember(db.pool, list, tomek);

    const response = await requestsAs(app, tomek)("POST", `/api/v1/lists/${list.id}/items`, {
      name: "Chleb",
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      name: "Chleb",
      note: null,
      addedBy: { id: tomek.id, name: "Tomek" },
    });
    await app.close();
  });

  it("shows the new item in the list before older ones, without e-mails (AC1, SEC2)", async () => {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app, { name: "Ania" });
    const tomek = await createUser(app, { name: "Tomek" });
    const list = await createList(db.pool, ania);
    await addMember(db.pool, list, tomek);
    const milk = await requestsAs(app, ania)("POST", `/api/v1/lists/${list.id}/items`, {
      name: "Mleko",
    });
    const bread = await requestsAs(app, tomek)("POST", `/api/v1/lists/${list.id}/items`, {
      name: "Chleb",
    });

    const response = await requestsAs(app, tomek)("GET", `/api/v1/lists/${list.id}`);

    expect(response.statusCode).toBe(200);
    expect(response.json<{ items: unknown[] }>().items).toEqual([bread.json(), milk.json()]);
    expect(response.body).not.toContain(ania.email);
    expect(response.body).not.toContain(tomek.email);
    await app.close();
  });

  it("moves the list to the top of „Moje listy” (updated_at, SC-05)", async () => {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app);
    const older = await createList(db.pool, ania, "Starsza");
    await createList(db.pool, ania, "Nowsza");
    const asAnia = requestsAs(app, ania);

    await asAnia("POST", `/api/v1/lists/${older.id}/items`, { name: "Mleko" });
    const response = await asAnia("GET", "/api/v1/lists");

    expect(response.json<{ name: string }[]>().map((list) => list.name)).toEqual([
      "Starsza",
      "Nowsza",
    ]);
    await app.close();
  });
});
