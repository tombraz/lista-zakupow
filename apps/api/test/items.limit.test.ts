import { randomUUID } from "node:crypto";
import { BUSINESS_LIMITS } from "@lista/shared";
import { describe, expect, it } from "vitest";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { createList, createUser, type TestList, type TestUser } from "./factories";
import { captureLogs } from "./logs";
import { requestsAs } from "./requests";

const LIMIT_REACHED = { error: { code: "limit_reached", limit: "items" } };

// AC5, SEC3 (F-07, TH-13, MC-05): najwyżej 500 pozycji na liście, także przy równoległych żądaniach.
describe("limit of 500 items per list", () => {
  const db = useTestDatabase();

  /** `count` pozycji jednym zapytaniem (500 żądań HTTP trwałoby za długo). */
  async function fill(list: TestList, by: TestUser, count: number) {
    await db.pool.query(
      `INSERT INTO item (id, list_id, name, name_key, added_by)
       SELECT gen_random_uuid(), $1, 'Pozycja ' || n, 'pozycja ' || n, $2
       FROM generate_series(1, $3::int) AS n`,
      [list.id, by.id, count],
    );
  }

  async function itemCount(list: TestList) {
    const { rows } = await db.pool.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM item WHERE list_id = $1",
      [list.id],
    );
    return rows[0]?.count;
  }

  async function setUp(filled: number) {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app);
    const list = await createList(db.pool, ania);
    await fill(list, ania, filled);
    const add = (body: object) =>
      requestsAs(app, ania)("POST", `/api/v1/lists/${list.id}/items`, body);
    return { app, ania, list, add };
  }

  it("is 500 items", () => {
    expect(BUSINESS_LIMITS.itemsPerList).toBe(500);
  });

  it("answers 409 limit_reached for the 501st item and adds nothing", async () => {
    const { app, list, add } = await setUp(500);

    const response = await add({ name: "Mleko" });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual(LIMIT_REACHED);
    expect(await itemCount(list)).toBe(500);
    await app.close();
  });

  it("lets exactly one of two parallel requests add the 500th item", async () => {
    const { app, list, add } = await setUp(499);

    const responses = await Promise.all([add({ name: "Mleko" }), add({ name: "Chleb" })]);

    expect(responses.map((response) => response.statusCode).sort()).toEqual([201, 409]);
    expect(await itemCount(list)).toBe(500);
    await app.close();
  });

  // Dwa żądania przez `inject` rzadko się nakładają; dwadzieścia naraz wymusza wyścig.
  it("never exceeds 500 items under many parallel requests", async () => {
    const { app, list, add } = await setUp(490);

    const responses = await Promise.all(
      Array.from({ length: 20 }, (_, index) => add({ name: `Równoległa ${String(index)}` })),
    );

    const statuses = responses.map((response) => response.statusCode);
    expect(statuses.filter((status) => status === 201)).toHaveLength(10);
    expect(statuses.filter((status) => status === 409)).toHaveLength(10);
    expect(await itemCount(list)).toBe(500);
    await app.close();
  });

  it("still answers a repeated request for an existing item at the limit with 200 (AC6)", async () => {
    const { app, add } = await setUp(499);
    const id = randomUUID();
    expect((await add({ id, name: "Mleko" })).statusCode).toBe(201);

    const repeat = await add({ id, name: "Mleko" });

    expect(repeat.statusCode).toBe(200);
    await app.close();
  });

  it("stops a bot adding in a loop at 500 and logs it with identifiers only (SEC3)", async () => {
    const logs = captureLogs();
    const app = buildTestApp(db.pool, { logger: { level: "info", stream: logs.stream } });
    const bot = await createUser(app);
    const list = await createList(db.pool, bot);
    await fill(list, bot, 497);
    const asBot = requestsAs(app, bot);

    const statuses: number[] = [];
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await asBot("POST", `/api/v1/lists/${list.id}/items`, {
        name: `Spam ${String(attempt)}`,
      });
      statuses.push(response.statusCode);
    }

    expect(statuses).toEqual([201, 201, 201, 409, 409]);
    const limited = logs.security().filter((entry) => entry["event"] === "limit_reached");
    expect(limited).toHaveLength(2);
    expect(limited[0]).toMatchObject({ userId: bot.id, listId: list.id, limit: "items" });
    expect(logs.lines.join("\n")).not.toContain("Spam 4");
    await app.close();
  });
});
