import { randomUUID } from "node:crypto";
import type { ListSummary } from "@lista/shared";
import { describe, expect, it } from "vitest";
import { buildTestApp, TEST_ORIGIN } from "./app";
import { useTestDatabase } from "./database";
import { expectOneAnnounceFailure, failingLive } from "./failing-live";
import { createInvitation, createList, createUser, randomIp } from "./factories";
import { captureLogs } from "./logs";
import { requestsAs } from "./requests";

// T-089 AC1 (F-11, F-12, F-14): przyjęcie i unieważnienie linku są już zatwierdzone, więc błąd
// rozesłania zdarzeń na żywo trafia tylko do logu, a odpowiedź oddaje wynik zapisu.
describe("invitation routes when the live announcement fails", () => {
  const db = useTestDatabase();

  async function setUp() {
    const logs = captureLogs();
    const live = failingLive("publish", "notify");
    const app = buildTestApp(db.pool, { live, logger: { level: "info", stream: logs.stream } });
    const ania = await createUser(app, { name: "Ania" });
    const list = await createList(db.pool, ania, "Działka");
    const link = await createInvitation(db.pool, list);
    const personal = ["Ania", "Działka", ania.email];
    return { app, logs, ania, list, link, personal };
  }

  it("POST /api/v1/invitations/:token/accept answers 200 and the user joins the list", async () => {
    const { app, logs, list, link, personal } = await setUp();
    const bartek = await createUser(app, { name: "Bartek" });

    const response = await requestsAs(app, bartek)(
      "POST",
      `/api/v1/invitations/${link.token}/accept`,
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ listId: list.id });
    const lists = await requestsAs(app, bartek)("GET", "/api/v1/lists");
    expect(lists.json<ListSummary[]>().map((l) => l.id)).toEqual([list.id]);
    expectOneAnnounceFailure(logs, [...personal, "Bartek", bartek.email]);
    await app.close();
  });

  it("sign-up with invitationToken answers 200 with the joined list", async () => {
    const { app, logs, list, link, personal } = await setUp();
    const email = `tomek-${randomUUID()}@example.com`;

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      headers: { origin: TEST_ORIGIN },
      remoteAddress: randomIp(),
      payload: {
        name: "Tomek",
        email,
        password: "haslo-tomka-123",
        termsAccepted: true,
        ageConfirmed: true,
        invitationToken: link.token,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ user: { id: string }; invitation: unknown }>();
    expect(body.invitation).toEqual({ listId: list.id });
    const { rows } = await db.pool.query("SELECT used_by FROM invitation WHERE id = $1", [link.id]);
    expect(rows).toEqual([{ used_by: body.user.id }]);
    expectOneAnnounceFailure(logs, [...personal, "Tomek", email]);
    await app.close();
  });

  it("DELETE /api/v1/lists/:listId/invitations/:invitationId answers 204 and revokes the link", async () => {
    const { app, logs, ania, list, link, personal } = await setUp();

    const response = await requestsAs(app, ania)(
      "DELETE",
      `/api/v1/lists/${list.id}/invitations/${link.id}`,
    );

    expect(response.statusCode).toBe(204);
    const active = await requestsAs(app, ania)("GET", `/api/v1/lists/${list.id}/invitations`);
    expect(active.json()).toEqual([]);
    expectOneAnnounceFailure(logs, personal);
    await app.close();
  });
});
