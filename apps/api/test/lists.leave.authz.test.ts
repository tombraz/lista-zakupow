import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { addMember, createList, createUser } from "./factories";
import { requestsAs } from "./requests";

// T-059 AC2 (F-13), SEC2 (TH-01): kto może opuścić listę.
describe("authorization of POST /api/v1/lists/:listId/leave", () => {
  const db = useTestDatabase();

  async function homeOfAnia() {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app, { name: "Ania" });
    const tomek = await createUser(app, { name: "Tomek" });
    const bartek = await createUser(app, { name: "Bartek" });
    const list = await createList(db.pool, ania, "Dom");
    await addMember(db.pool, list, tomek);
    return { app, ania, tomek, bartek, list };
  }

  async function memberIds(listId: string) {
    const { rows } = await db.pool.query<{ user_id: string }>(
      "SELECT user_id FROM list_member WHERE list_id = $1 ORDER BY user_id",
      [listId],
    );
    return rows.map((row) => row.user_id);
  }

  it("answers 403 owner_cannot_leave to the owner and changes nothing", async () => {
    const { app, ania, list } = await homeOfAnia();
    const before = await memberIds(list.id);
    const asAnia = requestsAs(app, ania);

    const response = await asAnia("POST", `/api/v1/lists/${list.id}/leave`);

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: { code: "owner_cannot_leave" } });
    expect(await memberIds(list.id)).toEqual(before);
    const lists = (await asAnia("GET", "/api/v1/lists")).json<{ id: string; role: string }[]>();
    expect(lists.map(({ id, role }) => ({ id, role }))).toEqual([{ id: list.id, role: "owner" }]);
    await app.close();
  });

  it("answers 404 to someone without access, exactly like a missing list, and 401 to anonymous", async () => {
    const { app, bartek, list } = await homeOfAnia();
    const before = await memberIds(list.id);
    const asBartek = requestsAs(app, bartek);
    const path = (listId: string) => `/api/v1/lists/${listId}/leave`;

    const foreign = await asBartek("POST", path(list.id));
    const missing = await asBartek("POST", path(randomUUID()));
    const malformed = await asBartek("POST", path("nie-uuid"));
    const nul = await asBartek("POST", path("%00"));
    const anonymous = await requestsAs(app, null)("POST", path(list.id));

    for (const response of [foreign, missing, malformed, nul]) {
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: { code: "not_found" } });
    }
    expect(anonymous.statusCode).toBe(401);
    expect(anonymous.json()).toEqual({ error: { code: "unauthenticated" } });
    expect(await memberIds(list.id)).toEqual(before);
    await app.close();
  });

  // TH-14: wyjście zmienia stan, więc obcy `Origin` (CSRF) nie wypisuje uczestnika.
  it("answers 403 invalid_origin to a participant's leave from a foreign Origin and keeps him", async () => {
    const { app, tomek, list } = await homeOfAnia();
    const before = await memberIds(list.id);

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/lists/${list.id}/leave`,
      headers: { cookie: tomek.cookie, origin: "https://evil.example" },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: { code: "invalid_origin" } });
    expect(await memberIds(list.id)).toEqual(before);
    await app.close();
  });
});
