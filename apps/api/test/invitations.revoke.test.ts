import type { Invitation } from "@lista/shared";
import { describe, expect, it } from "vitest";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { createList, createUser } from "./factories";
import { tokenOf } from "./invitations";
import { requestsAs } from "./requests";

// AC2 (F-11): właściciel unieważnia niewykorzystany link; link przestaje działać.
describe("DELETE /api/v1/lists/:listId/invitations/:invitationId", () => {
  const db = useTestDatabase();

  it("revokes the link: 204, gone from the active links, preview answers 410", async () => {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app);
    const list = await createList(db.pool, ania, "Dom");
    const asAnia = requestsAs(app, ania);
    const invitations = `/api/v1/lists/${list.id}/invitations`;
    const link = (await asAnia("POST", invitations)).json<Invitation>();
    const preview = () => requestsAs(app, null)("GET", `/api/v1/invitations/${tokenOf(link)}`);
    expect((await preview()).statusCode).toBe(200);

    const response = await asAnia("DELETE", `${invitations}/${link.id}`);

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe("");
    expect((await asAnia("GET", invitations)).json()).toEqual([]);
    const after = await preview();
    expect(after.statusCode).toBe(410);
    expect(after.json()).toEqual({ error: { code: "invitation_invalid" } });
    await app.close();
  });

  it("answers 404 for an unknown, already revoked or malformed link id", async () => {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app);
    const list = await createList(db.pool, ania);
    const asAnia = requestsAs(app, ania);
    const invitations = `/api/v1/lists/${list.id}/invitations`;
    const link = (await asAnia("POST", invitations)).json<Invitation>();
    await asAnia("DELETE", `${invitations}/${link.id}`);

    for (const id of [link.id, "0190f0e0-0000-7000-8000-000000000000", "nie-uuid"]) {
      const response = await asAnia("DELETE", `${invitations}/${id}`);
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: { code: "not_found" } });
    }
    await app.close();
  });
});
