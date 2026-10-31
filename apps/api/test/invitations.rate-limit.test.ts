import { RATE_LIMITS } from "@lista/shared";
import { describe, expect, it } from "vitest";
import { buildTestApp, TEST_ORIGIN } from "./app";
import { testClock } from "./clock";
import { useTestDatabase } from "./database";
import { createInvitation, createList, createUser, randomIp } from "./factories";
import { requestsAs } from "./requests";

const RATE_LIMITED = { error: { code: "rate_limited" } };

// SEC4 (TH-06): odgadywanie tokenu ograniczone per IP; SEC6 (TH-13): tworzenie linków.
describe("invitation rate limits", () => {
  const db = useTestDatabase();

  it.each([
    ["GET", "/api/v1/invitations/TOKEN"],
    ["POST", "/api/v1/invitations/TOKEN/accept"],
  ] as const)("%s %s: 429 after 30 requests a minute from one IP", async (method, path) => {
    const app = buildTestApp(db.pool);
    const tomek = await createUser(app);
    const ip = randomIp();
    const { max } = RATE_LIMITS.invitationLookupPerIp;
    const send = (remoteAddress: string) =>
      app.inject({
        method,
        url: path.replace("TOKEN", "A".repeat(43)),
        headers: { origin: TEST_ORIGIN, cookie: tomek.cookie },
        remoteAddress,
      });

    for (let attempt = 0; attempt < max; attempt += 1) {
      expect((await send(ip)).statusCode).toBe(410);
    }
    const limited = await send(ip);

    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toEqual(RATE_LIMITED);
    expect((await send(randomIp())).statusCode).toBe(410);
    await app.close();
  });

  it("POST /api/v1/lists/:listId/invitations: 429 above 20 links an hour per list", async () => {
    const clock = testClock("2026-11-02T10:00:00.000Z");
    const app = buildTestApp(db.pool, { clock });
    const ania = await createUser(app);
    const list = await createList(db.pool, ania);
    const other = await createList(db.pool, ania);
    const { max } = RATE_LIMITS.invitationsCreatedPerList;
    // Linki sprzed godziny się nie liczą.
    await createInvitation(db.pool, list, new Date("2026-11-02T08:59:59.000Z"));
    const create = (listId: string) =>
      requestsAs(app, ania)("POST", `/api/v1/lists/${listId}/invitations`);

    for (let attempt = 0; attempt < max; attempt += 1) {
      expect((await create(list.id)).statusCode).toBe(201);
    }
    const limited = await create(list.id);

    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toEqual(RATE_LIMITED);
    expect((await create(other.id)).statusCode).toBe(201);
    clock.set("2026-11-02T11:00:00.001Z");
    expect((await create(list.id)).statusCode).toBe(201);
    await app.close();
  });
});
