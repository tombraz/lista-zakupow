import { describe, expect, it } from "vitest";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { addMember, createInvitation, createList, createUser } from "./factories";
import { requestsAs } from "./requests";

// SEC2 (TH-01), SEC3 (TH-02): linki listy widzi i zmienia tylko jej właściciel.
describe("invitation routes authorization", () => {
  const db = useTestDatabase();

  async function setup() {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app);
    const tomek = await createUser(app);
    const obcy = await createUser(app);
    const list = await createList(db.pool, ania);
    await addMember(db.pool, list, tomek);
    const link = await createInvitation(db.pool, list);
    const base = `/api/v1/lists/${list.id}/invitations`;
    const calls = [
      ["GET", base],
      ["POST", base],
      ["DELETE", `${base}/${link.id}`],
    ] as const;
    const invitationCount = async () =>
      (await db.pool.query("SELECT 1 FROM invitation WHERE revoked_at IS NULL")).rows.length;
    return { app, tomek, obcy, link, calls, invitationCount };
  }

  it("another user gets 404 not_found and nothing changes", async () => {
    const { app, obcy, calls, invitationCount } = await setup();
    for (const [method, url] of calls) {
      const response = await requestsAs(app, obcy)(method, url);
      expect(response.statusCode, `${method} ${url}`).toBe(404);
      expect(response.json()).toEqual({ error: { code: "not_found" } });
    }
    expect(await invitationCount()).toBe(1);
    await app.close();
  });

  it("a participant gets 403 owner_only and nothing changes", async () => {
    const { app, tomek, calls, invitationCount } = await setup();
    for (const [method, url] of calls) {
      const response = await requestsAs(app, tomek)(method, url);
      expect(response.statusCode, `${method} ${url}`).toBe(403);
      expect(response.json()).toEqual({ error: { code: "owner_only" } });
    }
    expect(await invitationCount()).toBe(1);
    await app.close();
  });

  it("anonymous gets 401 on owner routes and on accept", async () => {
    const { app, link, calls, invitationCount } = await setup();
    const anonymous = requestsAs(app, null);
    for (const [method, url] of [
      ...calls,
      ["POST", `/api/v1/invitations/${link.token}/accept`] as const,
    ]) {
      const response = await anonymous(method, url);
      expect(response.statusCode, `${method} ${url}`).toBe(401);
      expect(response.json()).toEqual({ error: { code: "unauthenticated" } });
    }
    expect(await invitationCount()).toBe(1);
    const { rows } = await db.pool.query("SELECT used_at FROM invitation");
    expect(rows).toEqual([{ used_at: null }]);
    await app.close();
  });
});
