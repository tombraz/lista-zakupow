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
