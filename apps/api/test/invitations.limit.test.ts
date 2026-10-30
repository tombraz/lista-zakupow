import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { describe, expect, it } from "vitest";
import { user } from "../src/db/schema";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { addMember, createInvitation, createList, createUser, type TestList } from "./factories";
import { captureLogs } from "./logs";
import { requestsAs } from "./requests";

const LIMIT = { error: { code: "limit_reached", limit: "participants" } };

// AC6 (F-12): lista ma najwyżej 20 uczestników (właściciel się nie liczy).
describe("participant limit 20", () => {
  const db = useTestDatabase();

  // Konta wprost w bazie: 20 rejestracji przez API trwałoby zbyt długo.
  async function fillWithParticipants(list: TestList, count: number) {
    const people = Array.from({ length: count }, () => {
      const id = randomUUID();
      return { id, name: "Uczestnik", email: `${id}@example.com` };
    });
    await drizzle(db.pool).insert(user).values(people);
    for (const person of people) await addMember(db.pool, list, person);
  }

  it("accepting at 20 participants: 409 limit_reached, no membership, link stays unused", async () => {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app);
    const tomek = await createUser(app);
    const list = await createList(db.pool, ania);
    await fillWithParticipants(list, 20);
    const link = await createInvitation(db.pool, list);

    const response = await requestsAs(app, tomek)(
      "POST",
      `/api/v1/invitations/${link.token}/accept`,
    );

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual(LIMIT);
    const { rows } = await db.pool.query(
      "SELECT 1 FROM list_member WHERE list_id = $1 AND user_id = $2",
      [list.id, tomek.id],
    );
    expect(rows).toEqual([]);
    const active = await requestsAs(app, ania)("GET", `/api/v1/lists/${list.id}/invitations`);
    expect(active.json()).toHaveLength(1);
    await app.close();
  });

  it("the 20th participant still joins", async () => {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app);
    const tomek = await createUser(app);
    const list = await createList(db.pool, ania);
    await fillWithParticipants(list, 19);
    const link = await createInvitation(db.pool, list);

    const response = await requestsAs(app, tomek)(
      "POST",
      `/api/v1/invitations/${link.token}/accept`,
    );

    expect(response.statusCode).toBe(200);
    await app.close();
  });

  it("creating a link at 20 participants: 409 limit_reached", async () => {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app);
    const list = await createList(db.pool, ania);
    await fillWithParticipants(list, 20);

    const response = await requestsAs(app, ania)("POST", `/api/v1/lists/${list.id}/invitations`);

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual(LIMIT);
    await app.close();
  });

  // T-027 (TH-21): każde przekroczenie limitu zostawia ślad w logu `security`.
  it("logs limit_reached when creating a link on a full list", async () => {
    const logs = captureLogs();
    const app = buildTestApp(db.pool, { logger: { level: "info", stream: logs.stream } });
    const ania = await createUser(app);
    const list = await createList(db.pool, ania);
    await fillWithParticipants(list, 20);

    const response = await requestsAs(app, ania)("POST", `/api/v1/lists/${list.id}/invitations`);

    expect(response.statusCode).toBe(409);
    const limited = logs.security().filter((entry) => entry["event"] === "limit_reached");
    expect(limited).toEqual([
      expect.objectContaining({
        userId: ania.id,
        listId: list.id,
        limit: "participantsPerList",
        route: "/api/v1/lists/:listId/invitations",
      }),
    ]);
    await app.close();
  });
});
