import { randomUUID } from "node:crypto";
import type { ListSummary } from "@lista/shared";
import { describe, expect, it } from "vitest";
import { buildTestApp, TEST_ORIGIN } from "./app";
import { cookieHeader } from "./cookies";
import { useTestDatabase } from "./database";
import { createInvitation, createList, createUser, randomIp } from "./factories";
import { requestsAs } from "./requests";

// AC5 (F-01, F-12): osoba bez konta zakłada je z linku i od razu jest uczestnikiem listy;
// błąd zaproszenia nie blokuje rejestracji.
describe("POST /api/auth/sign-up/email with invitationToken", () => {
  const db = useTestDatabase();

  function signUp(app: ReturnType<typeof buildTestApp>, invitationToken: string) {
    return app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      headers: { origin: TEST_ORIGIN },
      remoteAddress: randomIp(),
      payload: {
        name: "Tomek",
        email: `tomek-${randomUUID()}@example.com`,
        password: "haslo-tomka-123",
        termsAccepted: true,
        ageConfirmed: true,
        invitationToken,
      },
    });
  }

  it("a valid token: the account is created and joins the list at once", async () => {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app, { name: "Ania" });
    const list = await createList(db.pool, ania, "Dom");
    const link = await createInvitation(db.pool, list);

    const response = await signUp(app, link.token);

    expect(response.statusCode).toBe(200);
    const body = response.json<{ user: { id: string }; invitation: unknown }>();
    expect(body.invitation).toEqual({ listId: list.id });
    const tomek = { cookie: cookieHeader(response.headers["set-cookie"]) };
    const lists = (await requestsAs(app, tomek)("GET", "/api/v1/lists")).json<ListSummary[]>();
    expect(lists).toMatchObject([{ id: list.id, role: "participant" }]);
    const { rows } = await db.pool.query("SELECT used_by FROM invitation WHERE id = $1", [link.id]);
    expect(rows).toEqual([{ used_by: body.user.id }]);
    await app.close();
  });

  it("an invalid token: the account is still created and the response says why", async () => {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app);
    const list = await createList(db.pool, ania);
    const link = await createInvitation(db.pool, list);
    await db.pool.query("UPDATE invitation SET revoked_at = now() WHERE id = $1", [link.id]);

    for (const token of [link.token, "zly-token"]) {
      const response = await signUp(app, token);

      expect(response.statusCode).toBe(200);
      const body = response.json<{ user: { id: string }; invitation: unknown }>();
      expect(body.user.id).toEqual(expect.any(String));
      expect(body.invitation).toEqual({ error: { code: "invitation_invalid" } });
      const tomek = { cookie: cookieHeader(response.headers["set-cookie"]) };
      expect((await requestsAs(app, tomek)("GET", "/api/v1/lists")).json()).toEqual([]);
    }
    await app.close();
  });

  it("without invitationToken the response has no invitation field", async () => {
    const app = buildTestApp(db.pool);
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      headers: { origin: TEST_ORIGIN },
      remoteAddress: randomIp(),
      payload: {
        name: "Ola",
        email: `ola-${randomUUID()}@example.com`,
        password: "haslo-oli-1234",
        termsAccepted: true,
        ageConfirmed: true,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(Object.keys(response.json<object>())).toEqual(["user"]);
    await app.close();
  });
});
