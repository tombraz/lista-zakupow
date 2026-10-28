import type { ListSummary } from "@lista/shared";
import { describe, expect, it } from "vitest";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { createInvitation, createList, createUser } from "./factories";
import { requestsAs } from "./requests";

// AC4 (F-12): zalogowany domownik przyjmuje zaproszenie i od razu widzi listę.
describe("POST /api/v1/invitations/:token/accept", () => {
  const db = useTestDatabase();

  it("adds the member, marks the link as used and shows the list as participant", async () => {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app, { name: "Ania" });
    const tomek = await createUser(app, { name: "Tomek" });
    const list = await createList(db.pool, ania, "Dom");
    const link = await createInvitation(db.pool, list);
    const asTomek = requestsAs(app, tomek);

    const response = await asTomek("POST", `/api/v1/invitations/${link.token}/accept`);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ listId: list.id });
    const lists = (await asTomek("GET", "/api/v1/lists")).json<ListSummary[]>();
    expect(lists).toMatchObject([
      { id: list.id, name: "Dom", role: "participant", owner: { id: ania.id, name: "Ania" } },
    ]);
    const forAnia = (await requestsAs(app, ania)("GET", "/api/v1/lists")).json<ListSummary[]>();
    expect(forAnia[0]?.members).toEqual([{ id: tomek.id, name: "Tomek" }]);
    const { rows } = await db.pool.query<{ used_by: string; used: boolean }>(
      "SELECT used_by, used_at IS NOT NULL AS used FROM invitation WHERE id = $1",
      [link.id],
    );
    expect(rows).toEqual([{ used_by: tomek.id, used: true }]);
    const active = await requestsAs(app, ania)("GET", `/api/v1/lists/${list.id}/invitations`);
    expect(active.json()).toEqual([]);
    await app.close();
  });
});
