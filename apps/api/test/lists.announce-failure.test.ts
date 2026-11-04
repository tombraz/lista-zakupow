import type { ListSummary } from "@lista/shared";
import { describe, expect, it } from "vitest";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { expectOneAnnounceFailure, failingLive } from "./failing-live";
import { failingPool } from "./failing-pool";
import { addMember, createList, createUser } from "./factories";
import { captureLogs } from "./logs";
import { requestsAs } from "./requests";

// T-089 AC1 (F-05, F-13, F-14): zapis listy jest już zatwierdzony, więc błąd rozesłania zdarzeń
// na żywo trafia tylko do logu, a odpowiedź oddaje wynik zapisu.
describe("list routes when the live announcement fails", () => {
  const db = useTestDatabase();

  async function setUp(live = failingLive("publish", "notify"), pool = db.pool) {
    const logs = captureLogs();
    const app = buildTestApp(pool, { live, logger: { level: "info", stream: logs.stream } });
    const ania = await createUser(app, { name: "Ania" });
    const bartek = await createUser(app, { name: "Bartek" });
    const list = await createList(db.pool, ania, "Działka");
    await addMember(db.pool, list, bartek);
    const personal = ["Ania", "Bartek", "Działka", ania.email, bartek.email];
    return { app, logs, ania, bartek, list, personal };
  }

  const listIds = async (app: ReturnType<typeof buildTestApp>, user: { cookie: string }) =>
    (await requestsAs(app, user)("GET", "/api/v1/lists")).json<ListSummary[]>().map((l) => l.id);

  it("POST /api/v1/lists answers 201 and the list is saved", async () => {
    const { app, logs, ania, personal } = await setUp();

    const response = await requestsAs(app, ania)("POST", "/api/v1/lists", { name: "Spiżarnia" });

    expect(response.statusCode).toBe(201);
    const { id } = response.json<ListSummary>();
    expect(await listIds(app, ania)).toContain(id);
    expectOneAnnounceFailure(logs, [...personal, "Spiżarnia"]);
    await app.close();
  });

  it("PATCH /api/v1/lists/:listId answers 200 with the new name and saves it", async () => {
    const { app, logs, ania, list, personal } = await setUp();

    const response = await requestsAs(app, ania)("PATCH", `/api/v1/lists/${list.id}`, {
      name: "Ogród",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: list.id, name: "Ogród" });
    const details = await requestsAs(app, ania)("GET", `/api/v1/lists/${list.id}`);
    expect(details.json()).toMatchObject({ name: "Ogród" });
    expectOneAnnounceFailure(logs, [...personal, "Ogród"]);
    await app.close();
  });

  it("PATCH /api/v1/lists/:listId answers 200 when only notify fails after publish", async () => {
    const { app, logs, ania, list, personal } = await setUp(failingLive("notify"));

    const response = await requestsAs(app, ania)("PATCH", `/api/v1/lists/${list.id}`, {
      name: "Ogród",
    });

    expect(response.statusCode).toBe(200);
    expectOneAnnounceFailure(logs, [...personal, "Ogród"]);
    await app.close();
  });

  // QA plan, edge case: błąd bazy przy `peopleWithAccess` po zatwierdzonej zmianie nazwy.
  it("PATCH /api/v1/lists/:listId answers 200 when reading the people with access fails", async () => {
    // Tylko odczyt uczestników w `peopleWithAccess` (sprawdzenie dostępu łączy tabele inaczej).
    const peopleQuery = /^select "user_id" from "list_member" where "list_member"."list_id" = \$1$/;
    const pool = failingPool(db.pool, peopleQuery);
    const { app, logs, ania, list, personal } = await setUp(failingLive(), pool);

    const response = await requestsAs(app, ania)("PATCH", `/api/v1/lists/${list.id}`, {
      name: "Ogród",
    });

    expect(response.statusCode).toBe(200);
    expect(
      (await db.pool.query("SELECT name FROM shopping_list WHERE id = $1", [list.id])).rows,
    ).toEqual([{ name: "Ogród" }]);
    const failures = logs.entries().filter((entry) => entry["level"] === 50);
    expect(failures.map((entry) => entry["event"])).toEqual(["live_announce_failed"]);
    for (const value of [...personal, "Ogród"]) expect(logs.lines.join("\n")).not.toContain(value);
    await app.close();
  });

  it("DELETE /api/v1/lists/:listId answers 204 and the list is deleted", async () => {
    const { app, logs, ania, bartek, list, personal } = await setUp();

    const response = await requestsAs(app, ania)("DELETE", `/api/v1/lists/${list.id}`);

    expect(response.statusCode).toBe(204);
    expect(await listIds(app, ania)).not.toContain(list.id);
    expect(await listIds(app, bartek)).not.toContain(list.id);
    expectOneAnnounceFailure(logs, personal);
    await app.close();
  });

  it("DELETE /api/v1/lists/:listId/members/:userId answers 204 and still logs member_removed", async () => {
    const { app, logs, ania, bartek, list, personal } = await setUp();

    const response = await requestsAs(app, ania)(
      "DELETE",
      `/api/v1/lists/${list.id}/members/${bartek.id}`,
    );

    expect(response.statusCode).toBe(204);
    expect(await listIds(app, bartek)).not.toContain(list.id);
    expect(logs.security().map((entry) => entry["event"])).toContain("member_removed");
    expectOneAnnounceFailure(logs, personal);
    await app.close();
  });

  // T-077 AC1 (TH-21, TH-04): błąd bazy w `peopleWithAccess` po zatwierdzonym usunięciu.
  it("DELETE /api/v1/lists/:listId/members/:userId answers 204, logs member_removed and revokes when reading the people fails", async () => {
    const peopleQuery = /^select "user_id" from "list_member" where "list_member"."list_id" = \$1$/;
    const live = failingLive();
    const revoked: [string, string][] = [];
    const revoke = live.revoke.bind(live);
    live.revoke = (userId, listId) => {
      revoked.push([userId, listId]);
      revoke(userId, listId);
    };
    const { app, logs, ania, bartek, list, personal } = await setUp(
      live,
      failingPool(db.pool, peopleQuery),
    );

    const response = await requestsAs(app, ania)(
      "DELETE",
      `/api/v1/lists/${list.id}/members/${bartek.id}`,
    );

    expect(response.statusCode).toBe(204);
    expect(
      (await db.pool.query("SELECT user_id FROM list_member WHERE list_id = $1", [list.id])).rows,
    ).toEqual([]);
    expect(revoked).toEqual([[bartek.id, list.id]]);
    expect(logs.security()).toContainEqual(
      expect.objectContaining({
        event: "member_removed",
        listId: list.id,
        userId: ania.id,
        removedUserId: bartek.id,
      }),
    );
    const failures = logs.entries().filter((entry) => entry["level"] === 50);
    expect(failures.map((entry) => entry["event"])).toEqual(["live_announce_failed"]);
    for (const value of personal) expect(logs.lines.join("\n")).not.toContain(value);
    await app.close();
  });

  it("POST /api/v1/lists/:listId/leave answers 204 and the participant is gone", async () => {
    const { app, logs, bartek, list, personal } = await setUp();

    const response = await requestsAs(app, bartek)("POST", `/api/v1/lists/${list.id}/leave`);

    expect(response.statusCode).toBe(204);
    expect(await listIds(app, bartek)).not.toContain(list.id);
    expectOneAnnounceFailure(logs, personal);
    await app.close();
  });
});
