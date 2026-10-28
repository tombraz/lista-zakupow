import type { ListSummary } from "@lista/shared";
import { describe, expect, it } from "vitest";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { addMember, createList, createUser, type TestList } from "./factories";
import { requestsAs } from "./requests";

// AC4 (F-06): własne i udostępnione listy, od ostatnio zmienionej, z rolą i osobami.
describe("GET /api/v1/lists", () => {
  const db = useTestDatabase();

  async function touch(list: TestList, updatedAt: string) {
    await db.pool.query("UPDATE shopping_list SET updated_at = $1 WHERE id = $2", [
      updatedAt,
      list.id,
    ]);
  }

  async function household() {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app, { name: "Ania" });
    const tomek = await createUser(app, { name: "Tomek" });
    const ola = await createUser(app, { name: "Ola" });
    const own = await createList(db.pool, ania, "Dom");
    const shared = await createList(db.pool, tomek, "Działka");
    await addMember(db.pool, shared, ania);
    await addMember(db.pool, shared, ola);
    return { app, ania, tomek, ola, own, shared };
  }

  it("gives own and shared lists, the most recently changed first, in the API shape", async () => {
    const { app, ania, tomek, ola, own, shared } = await household();
    await touch(own, "2026-10-20T10:00:00Z");
    await touch(shared, "2026-10-21T10:00:00Z");

    const response = await requestsAs(app, ania)("GET", "/api/v1/lists");

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      {
        id: shared.id,
        name: "Działka",
        role: "participant",
        owner: { id: tomek.id, name: "Tomek" },
        toBuyCount: 0,
        members: [
          { id: ania.id, name: "Ania" },
          { id: ola.id, name: "Ola" },
        ],
        updatedAt: "2026-10-21T10:00:00.000Z",
      },
      {
        id: own.id,
        name: "Dom",
        role: "owner",
        owner: { id: ania.id, name: "Ania" },
        toBuyCount: 0,
        members: [],
        updatedAt: "2026-10-20T10:00:00.000Z",
      },
    ]);
    await app.close();
  });

  it("reorders when another list changed more recently", async () => {
    const { app, ania, own, shared } = await household();
    await touch(shared, "2026-10-21T10:00:00Z");
    await touch(own, "2026-10-22T10:00:00Z");

    const lists = (await requestsAs(app, ania)("GET", "/api/v1/lists")).json<ListSummary[]>();

    expect(lists.map((list) => list.name)).toEqual(["Dom", "Działka"]);
    await app.close();
  });

  it("gives a participant only the lists they have access to", async () => {
    const { app, ola } = await household();

    const lists = (await requestsAs(app, ola)("GET", "/api/v1/lists")).json<ListSummary[]>();

    expect(lists.map((list) => [list.name, list.role])).toEqual([["Działka", "participant"]]);
    await app.close();
  });

  it("gives a person without lists an empty array", async () => {
    const app = buildTestApp(db.pool);

    const response = await requestsAs(app, await createUser(app))("GET", "/api/v1/lists");

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
    await app.close();
  });
});
