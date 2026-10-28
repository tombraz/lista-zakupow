import type { ListSummary } from "@lista/shared";
import { describe, expect, it } from "vitest";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { createList, createUser } from "./factories";
import { requestsAs } from "./requests";

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// AC1 (F-05): utworzona lista należy do tworzącego i jest na początku jego list.
describe("POST /api/v1/lists", () => {
  const db = useTestDatabase();

  it("answers 201 with a list owned by the creator", async () => {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app, { name: "Ania" });

    const response = await requestsAs(app, ania)("POST", "/api/v1/lists", {
      name: "  Zakupy na tydzień  ",
    });

    expect(response.statusCode).toBe(201);
    const { id, updatedAt, ...list } = response.json<ListSummary>();
    expect(id).toMatch(UUID_V7);
    expect(Number.isNaN(Date.parse(updatedAt))).toBe(false);
    expect(list).toEqual({
      name: "Zakupy na tydzień",
      role: "owner",
      owner: { id: ania.id, name: "Ania" },
      toBuyCount: 0,
      members: [],
    });
    await app.close();
  });

  it("puts the new list first in GET /api/v1/lists with role owner", async () => {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app, { name: "Ania" });
    await createList(db.pool, ania, "Starsza lista");
    const asAnia = requestsAs(app, ania);

    const created = (await asAnia("POST", "/api/v1/lists", { name: "Nowa" })).json<ListSummary>();
    const response = await asAnia("GET", "/api/v1/lists");

    expect(response.statusCode).toBe(200);
    const lists = response.json<ListSummary[]>();
    expect(lists.map((list) => list.name)).toEqual(["Nowa", "Starsza lista"]);
    expect(lists[0]).toEqual(created);
    expect(lists[0]?.role).toBe("owner");
    await app.close();
  });
});
