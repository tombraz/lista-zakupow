import { BUSINESS_LIMITS } from "@lista/shared";
import { describe, expect, it } from "vitest";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { addMember, createList, createUser, type TestUser } from "./factories";
import { captureLogs } from "./logs";
import { requestsAs } from "./requests";

const LIMIT_REACHED = { error: { code: "limit_reached", limit: "lists" } };

// AC3, SEC4 (F-05, TH-13): najwyżej 50 własnych list, także przy równoległych żądaniach.
describe("limit of 50 own lists", () => {
  const db = useTestDatabase();

  async function ownListCount(owner: TestUser): Promise<number> {
    const { rows } = await db.pool.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM shopping_list WHERE owner_id = $1",
      [owner.id],
    );
    return rows[0]?.count ?? 0;
  }

  async function createLists(owner: TestUser, count: number) {
    for (let index = 0; index < count; index += 1) await createList(db.pool, owner);
  }

  it("is 50 lists", () => {
    expect(BUSINESS_LIMITS.listsPerOwner).toBe(50);
  });

  it("answers 409 limit_reached for the 51st list and creates nothing", async () => {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app);
    await createLists(ania, 50);

    const response = await requestsAs(app, ania)("POST", "/api/v1/lists", { name: "51." });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual(LIMIT_REACHED);
    expect(await ownListCount(ania)).toBe(50);
    await app.close();
  });

  it("lets exactly one of two parallel requests create the 50th list", async () => {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app);
    await createLists(ania, 49);
    const asAnia = requestsAs(app, ania);

    const responses = await Promise.all([
      asAnia("POST", "/api/v1/lists", { name: "Pierwsza" }),
      asAnia("POST", "/api/v1/lists", { name: "Druga" }),
    ]);

    expect(responses.map((response) => response.statusCode).sort()).toEqual([201, 409]);
    expect(await ownListCount(ania)).toBe(50);
    await app.close();
  });

  // Dwa żądania przez `inject` rzadko się nakładają; dwadzieścia naraz wymusza wyścig.
  it("never exceeds 50 lists under many parallel requests", async () => {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app);
    await createLists(ania, 40);
    const asAnia = requestsAs(app, ania);

    const responses = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        asAnia("POST", "/api/v1/lists", { name: `Równoległa ${String(index)}` }),
      ),
    );

    const statuses = responses.map((response) => response.statusCode);
    expect(statuses.filter((status) => status === 201)).toHaveLength(10);
    expect(statuses.filter((status) => status === 409)).toHaveLength(10);
    expect(await ownListCount(ania)).toBe(50);
    await app.close();
  });

  it("counts only own lists, not lists shared with the person", async () => {
    const app = buildTestApp(db.pool);
    const [ania, tomek] = [await createUser(app), await createUser(app)];
    await createLists(ania, 49);
    await addMember(db.pool, await createList(db.pool, tomek), ania);

    const response = await requestsAs(app, ania)("POST", "/api/v1/lists", { name: "50." });

    expect(response.statusCode).toBe(201);
    await app.close();
  });

  it("stops a bot creating lists in a loop after 50 and logs it with identifiers only", async () => {
    const logs = captureLogs();
    const app = buildTestApp(db.pool, { logger: { level: "info", stream: logs.stream } });
    const bot = await createUser(app);
    const asBot = requestsAs(app, bot);

    const statuses: number[] = [];
    for (let attempt = 1; attempt <= 52; attempt += 1) {
      const response = await asBot("POST", "/api/v1/lists", { name: `Spam ${String(attempt)}` });
      statuses.push(response.statusCode);
    }

    expect(statuses.filter((status) => status === 201)).toHaveLength(50);
    expect(statuses.slice(50)).toEqual([409, 409]);
    const limited = logs.security().filter((entry) => entry["event"] === "limit_reached");
    expect(limited).toHaveLength(2);
    expect(limited[0]).toMatchObject({ userId: bot.id, limit: "lists" });
    expect(logs.lines.join("\n")).not.toContain("Spam 51");
    await app.close();
  });
});
