import type { Invitation } from "@lista/shared";
import { describe, expect, it } from "vitest";
import { buildTestApp, TEST_ORIGIN } from "./app";
import { testClock } from "./clock";
import { useTestDatabase } from "./database";
import { createList, createUser } from "./factories";
import { requestsAs } from "./requests";

const TOKEN_URL = new RegExp(`^${TEST_ORIGIN}/zaproszenie/[A-Za-z0-9_-]{43}$`);

// AC1 (F-11): właściciel tworzy jednorazowy link ważny 7 dni i widzi aktywne linki.
describe("POST / GET /api/v1/lists/:listId/invitations", () => {
  const db = useTestDatabase();

  async function ownerWithList() {
    const clock = testClock("2026-11-02T10:00:00.000Z");
    const app = buildTestApp(db.pool, { clock });
    const ania = await createUser(app, { name: "Ania" });
    const list = await createList(db.pool, ania, "Dom");
    const asAnia = requestsAs(app, ania);
    const invitations = `/api/v1/lists/${list.id}/invitations`;
    return { app, clock, asAnia, invitations };
  }

  it("creates a link valid for 7 days: 201 { id, url, expiresAt }", async () => {
    const { app, asAnia, invitations } = await ownerWithList();

    const response = await asAnia("POST", invitations);

    expect(response.statusCode).toBe(201);
    const body = response.json<Invitation>();
    expect(Object.keys(body).sort()).toEqual(["expiresAt", "id", "url"]);
    expect(body.url).toMatch(TOKEN_URL);
    expect(body.expiresAt).toBe("2026-11-09T10:00:00.000Z");
    await app.close();
  });

  it("lists only active links, newest first", async () => {
    const { app, clock, asAnia, invitations } = await ownerWithList();
    const old = (await asAnia("POST", invitations)).json<Invitation>();
    clock.set("2026-11-05T10:00:00.000Z");
    const revoked = (await asAnia("POST", invitations)).json<Invitation>();
    await db.pool.query("UPDATE invitation SET revoked_at = now() WHERE id = $1", [revoked.id]);
    const used = (await asAnia("POST", invitations)).json<Invitation>();
    await db.pool.query("UPDATE invitation SET used_at = now() WHERE id = $1", [used.id]);
    const fresh = (await asAnia("POST", invitations)).json<Invitation>();

    const before = await asAnia("GET", invitations);
    expect(before.statusCode).toBe(200);
    expect(before.json<Invitation[]>()).toEqual([fresh, old]);

    // Pierwszy link wygasa dokładnie 7 dni po utworzeniu.
    clock.set("2026-11-09T10:00:00.000Z");
    expect((await asAnia("GET", invitations)).json<Invitation[]>()).toEqual([fresh]);
    await app.close();
  });
});
