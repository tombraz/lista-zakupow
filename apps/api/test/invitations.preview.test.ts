import { describe, expect, it } from "vitest";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { createInvitation, createList, createUser } from "./factories";
import { requestsAs } from "./requests";

// AC3 (F-11, MC-02): ważny link pokazuje każdemu tylko nazwę listy i imię właściciela.
describe("GET /api/v1/invitations/:token", () => {
  const db = useTestDatabase();

  it("shows only { listName, ownerName } to anyone, also without a session", async () => {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app, { name: "Ania" });
    const tomek = await createUser(app, { name: "Tomek" });
    const list = await createList(db.pool, ania, "Dom");
    const { token } = await createInvitation(db.pool, list);

    for (const viewer of [null, tomek, ania]) {
      const response = await requestsAs(app, viewer)("GET", `/api/v1/invitations/${token}`);
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ listName: "Dom", ownerName: "Ania" });
    }
    await app.close();
  });

  it("answers 410 without details for an unknown or malformed token", async () => {
    const app = buildTestApp(db.pool);
    for (const token of ["A".repeat(43), "krotki", "%27%3B--"]) {
      const response = await requestsAs(app, null)("GET", `/api/v1/invitations/${token}`);
      expect(response.statusCode).toBe(410);
      expect(response.json()).toEqual({ error: { code: "invitation_invalid" } });
    }
    await app.close();
  });
});
