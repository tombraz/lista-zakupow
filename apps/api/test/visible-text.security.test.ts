import { describe, expect, it } from "vitest";
import { buildTestApp, TEST_ORIGIN } from "./app";
import { useTestDatabase } from "./database";
import { createItem, createList, createUser, randomIp } from "./factories";
import { requestsAs } from "./requests";

const RLO = "‮";
const ZWSP = "​";
const invalid = (field: string) => ({
  error: { code: "validation_failed", fields: { [field]: "invalid" } },
});

// T-060 SEC1 (TH-29): każda trasa zapisu tekstu widocznego dla innych odrzuca znaki ukryte.
describe("text with hidden characters on every route that saves text for others", () => {
  const db = useTestDatabase();

  async function rows(sql: string) {
    return (await db.pool.query<Record<string, unknown>>(sql)).rows;
  }

  it("refuses to sign up with a name containing RLO and creates no account", async () => {
    const app = buildTestApp(db.pool);

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      headers: { origin: TEST_ORIGIN },
      remoteAddress: randomIp(),
      payload: {
        name: `Ania${RLO}gnp.exe`,
        email: "ania@example.com",
        password: "dobre-haslo-1",
        termsAccepted: true,
        ageConfirmed: true,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual(invalid("name"));
    expect(await rows(`SELECT 1 FROM "user"`)).toEqual([]);
    await app.close();
  });

  it("refuses to create a list named only U+200B and creates nothing", async () => {
    const app = buildTestApp(db.pool);
    const asAnia = requestsAs(app, await createUser(app));

    const response = await asAnia("POST", "/api/v1/lists", { name: ZWSP });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual(invalid("name"));
    expect(await rows("SELECT 1 FROM shopping_list")).toEqual([]);
    await app.close();
  });

  it("refuses to rename a list to a name with RLO and keeps the old name", async () => {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app);
    const list = await createList(db.pool, ania, "Zakupy");

    const response = await requestsAs(app, ania)("PATCH", `/api/v1/lists/${list.id}`, {
      name: `Zakupy${RLO}`,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual(invalid("name"));
    expect(await rows("SELECT name FROM shopping_list")).toEqual([{ name: "Zakupy" }]);
    await app.close();
  });

  async function listWithMilk() {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app);
    const list = await createList(db.pool, ania);
    const milk = await createItem(db.pool, list, ania, "Mleko");
    const asAnia = requestsAs(app, ania);
    return {
      app,
      add: (body: object) => asAnia("POST", `/api/v1/lists/${list.id}/items`, body),
      edit: (body: object) => asAnia("PATCH", `/api/v1/lists/${list.id}/items/${milk.id}`, body),
    };
  }

  it.each([
    ["a name with RLO", { name: `Chleb${RLO}` }, "name"],
    ["a name of U+200B only", { name: ZWSP }, "name"],
    ["a note with RLO", { name: "Chleb", note: `2 szt${RLO}` }, "note"],
  ])("refuses to add an item with %s and adds nothing", async (_case, body, field) => {
    const { app, add } = await listWithMilk();

    const response = await add(body);

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual(invalid(field));
    expect(await rows("SELECT name FROM item")).toEqual([{ name: "Mleko" }]);
    await app.close();
  });

  it.each([
    ["a name with RLO", { name: `Mleko${RLO}` }, "name"],
    ["a note with U+200B", { note: `2 l${ZWSP}` }, "note"],
  ])("refuses to change an item to %s and keeps it", async (_case, body, field) => {
    const { app, edit } = await listWithMilk();

    const response = await edit(body);

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual(invalid(field));
    expect(await rows("SELECT name, note FROM item")).toEqual([{ name: "Mleko", note: null }]);
    await app.close();
  });
});

// T-060 AC3 (F-09, TH-29): wariant zgodności Unicode to duplikat.
describe("adding a compatibility variant of a name that is already on the list", () => {
  const db = useTestDatabase();

  it.each([
    ["full-width letters", "Mleko", "ｍｌｅｋｏ"],
    ["the fi ligature", "filet", "ﬁlet"],
  ])("answers 409 duplicate_item for %s and adds nothing", async (_case, existing, variant) => {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app);
    const list = await createList(db.pool, ania);
    const add = (name: string) =>
      requestsAs(app, ania)("POST", `/api/v1/lists/${list.id}/items`, { name });
    expect((await add(existing)).statusCode).toBe(201);

    const response = await add(variant);

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: { code: "duplicate_item" } });
    const { rows } = await db.pool.query("SELECT name FROM item");
    expect(rows).toEqual([{ name: existing }]);
    await app.close();
  });
});

// T-060 SEC1, Demo 1 (decyzja właściciela 2026-11-01): nazwa pozycji odrzucona tylko za ukryte
// znaki, której klucz ma już inna pozycja listy, to duplikat (409), nie błąd pola.
describe("an item name with hidden characters whose key is already on the list", () => {
  const db = useTestDatabase();

  async function listWithMilkAndBread() {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app);
    const list = await createList(db.pool, ania);
    const milk = await createItem(db.pool, list, ania, "Mleko");
    const bread = await createItem(db.pool, list, ania, "Chleb");
    const asAnia = requestsAs(app, ania);
    return {
      app,
      list,
      add: (body: object) => asAnia("POST", `/api/v1/lists/${list.id}/items`, body),
      edit: (id: string, body: object) =>
        asAnia("PATCH", `/api/v1/lists/${list.id}/items/${id}`, body),
      milk,
      bread,
    };
  }

  async function items() {
    return (await db.pool.query<{ name: string }>("SELECT name FROM item ORDER BY name")).rows;
  }

  it("answers 409 duplicate_item when adding Mleko + U+200B next to Mleko and adds nothing", async () => {
    const { app, add } = await listWithMilkAndBread();

    const response = await add({ name: `Mleko${ZWSP}` });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: { code: "duplicate_item" } });
    expect(await items()).toEqual([{ name: "Chleb" }, { name: "Mleko" }]);
    await app.close();
  });

  it("answers 400 invalid when the name with U+200B is not on the list", async () => {
    const { app, add } = await listWithMilkAndBread();

    const response = await add({ name: `Masło${ZWSP}` });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual(invalid("name"));
    expect(await items()).toEqual([{ name: "Chleb" }, { name: "Mleko" }]);
    await app.close();
  });

  it("answers 400 with every field when the note is invalid too", async () => {
    const { app, add } = await listWithMilkAndBread();

    const response = await add({ name: `Mleko${ZWSP}`, note: `2 l${RLO}` });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: { code: "validation_failed", fields: { name: "invalid", note: "invalid" } },
    });
    await app.close();
  });

  it("answers 409 duplicate_item when renaming another item to Mleko + U+200B", async () => {
    const { app, edit, bread } = await listWithMilkAndBread();

    const response = await edit(bread.id, { name: `Mleko${ZWSP}` });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: { code: "duplicate_item" } });
    expect(await items()).toEqual([{ name: "Chleb" }, { name: "Mleko" }]);
    await app.close();
  });

  it("answers 400 invalid when renaming the item to its own name + U+200B", async () => {
    const { app, edit, milk } = await listWithMilkAndBread();

    const response = await edit(milk.id, { name: `Mleko${ZWSP}` });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual(invalid("name"));
    await app.close();
  });

  it("answers 404 to someone without access, without revealing the item", async () => {
    const { app, list } = await listWithMilkAndBread();
    const stranger = requestsAs(app, await createUser(app));

    const response = await stranger("POST", `/api/v1/lists/${list.id}/items`, {
      name: `Mleko${ZWSP}`,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: { code: "not_found" } });
    await app.close();
  });
});
