import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { addMember, createList, createUser } from "./factories";
import { requestsAs } from "./requests";

const NOT_FOUND = { error: { code: "not_found" } };

// T-058 SEC2 (TH-02), SEC3 (TH-01): kto może usunąć uczestnika.
describe("authorization of DELETE /api/v1/lists/:listId/members/:userId", () => {
  const db = useTestDatabase();

  async function homeOfAnia() {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app, { name: "Ania" });
    const tomek = await createUser(app, { name: "Tomek" });
    const ola = await createUser(app, { name: "Ola" });
    const bartek = await createUser(app, { name: "Bartek" });
    const list = await createList(db.pool, ania, "Dom");
    await addMember(db.pool, list, tomek);
    await addMember(db.pool, list, ola);
    return { app, ania, tomek, ola, bartek, list };
  }

  async function memberIds(listId: string) {
    const { rows } = await db.pool.query<{ user_id: string }>(
      "SELECT user_id FROM list_member WHERE list_id = $1 ORDER BY user_id",
      [listId],
    );
    return rows.map((row) => row.user_id);
  }

  it("answers 403 owner_only to a participant removing another participant or the owner", async () => {
    const { app, ania, tomek, ola, list } = await homeOfAnia();
    const before = await memberIds(list.id);
    const asTomek = requestsAs(app, tomek);

    for (const target of [ola, ania, tomek]) {
      const response = await asTomek("DELETE", `/api/v1/lists/${list.id}/members/${target.id}`);
      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({ error: { code: "owner_only" } });
    }
    expect(await memberIds(list.id)).toEqual(before);
    await app.close();
  });

  it("answers 404 to someone without access, exactly like a missing list, and 401 to anonymous", async () => {
    const { app, tomek, bartek, list } = await homeOfAnia();
    const before = await memberIds(list.id);
    const asBartek = requestsAs(app, bartek);
    const path = (listId: string) => `/api/v1/lists/${listId}/members/${tomek.id}`;

    const foreign = await asBartek("DELETE", path(list.id));
    const missing = await asBartek("DELETE", path(randomUUID()));
    const malformed = await asBartek("DELETE", path("nie-uuid"));
    const anonymous = await requestsAs(app, null)("DELETE", path(list.id));

    for (const response of [foreign, missing, malformed]) {
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual(NOT_FOUND);
    }
    expect(foreign.body).toBe(missing.body);
    expect(anonymous.statusCode).toBe(401);
    expect(anonymous.json()).toEqual({ error: { code: "unauthenticated" } });
    expect(await memberIds(list.id)).toEqual(before);
    await app.close();
  });

  it("answers 404 to the owner removing someone outside the list, an unknown id or themselves", async () => {
    const { app, ania, bartek, list } = await homeOfAnia();
    const before = await memberIds(list.id);
    const asAnia = requestsAs(app, ania);

    for (const userId of [bartek.id, randomUUID(), "nie-istnieje", ania.id]) {
      const response = await asAnia("DELETE", `/api/v1/lists/${list.id}/members/${userId}`);
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual(NOT_FOUND);
    }
    expect(await memberIds(list.id)).toEqual(before);
    const own = await asAnia("GET", `/api/v1/lists/${list.id}`);
    expect(own.statusCode).toBe(200);
    await app.close();
  });

  // QA T-058 round 1: NUL z adresu dochodził do PostgreSQL i kończył się 500.
  it("answers 404 to the owner for a participant id the database would not accept", async () => {
    const { app, ania, list } = await homeOfAnia();
    const before = await memberIds(list.id);
    const asAnia = requestsAs(app, ania);

    for (const userId of ["%00", "a%00b"]) {
      const response = await asAnia("DELETE", `/api/v1/lists/${list.id}/members/${userId}`);
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual(NOT_FOUND);
    }
    expect(await memberIds(list.id)).toEqual(before);
    await app.close();
  });

  it("removes nobody from another list of the owner when the participant id belongs elsewhere", async () => {
    const { app, ania, tomek, list } = await homeOfAnia();
    const other = await createList(db.pool, ania, "Działka");
    const asAnia = requestsAs(app, ania);

    const response = await asAnia("DELETE", `/api/v1/lists/${other.id}/members/${tomek.id}`);

    expect(response.statusCode).toBe(404);
    expect(await memberIds(list.id)).toContain(tomek.id);
    await app.close();
  });
});
