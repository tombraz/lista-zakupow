import { describe, expect, it } from "vitest";
import { buildTestApp } from "./app";
import { testClock } from "./clock";
import { useTestDatabase } from "./database";
import { createInvitation, createList, createUser } from "./factories";
import { requestsAs } from "./requests";

const INVALID = { error: { code: "invitation_invalid" } };

// SEC1 (TH-05, MC-02): wykorzystany, unieważniony albo wygasły link nie daje dostępu
// i nie zdradza listy; jeden link — jedno dołączenie, także przy równoległych próbach.
describe("invalid invitation links (MC-02)", () => {
  const db = useTestDatabase();

  async function setup(clockStart = "2026-11-02T10:00:00.000Z") {
    const clock = testClock(clockStart);
    const app = buildTestApp(db.pool, { clock });
    const ania = await createUser(app, { name: "Ania" });
    const tomek = await createUser(app, { name: "Tomek" });
    const ola = await createUser(app, { name: "Ola" });
    const list = await createList(db.pool, ania, "Dom");
    const link = await createInvitation(db.pool, list, new Date(clockStart));
    const preview = () => requestsAs(app, null)("GET", `/api/v1/invitations/${link.token}`);
    const accept = (as: { cookie: string }) =>
      requestsAs(app, as)("POST", `/api/v1/invitations/${link.token}/accept`);
    const members = async () =>
      (
        await db.pool.query<{ user_id: string }>(
          "SELECT user_id FROM list_member WHERE list_id = $1",
          [list.id],
        )
      ).rows;
    return { app, clock, ania, tomek, ola, list, link, preview, accept, members };
  }

  function expectInvalid(response: { statusCode: number; json: () => unknown; body: string }) {
    expect(response.statusCode).toBe(410);
    expect(response.json()).toEqual(INVALID);
    expect(response.body).not.toContain("Dom");
    expect(response.body).not.toContain("Ania");
  }

  it("a used link: second person gets 410 on preview and accept", async () => {
    const { app, tomek, ola, preview, accept, members } = await setup();
    expect((await accept(tomek)).statusCode).toBe(200);

    expectInvalid(await preview());
    expectInvalid(await accept(ola));
    expect(await members()).toEqual([{ user_id: tomek.id }]);
    await app.close();
  });

  it("a revoked link: 410 on preview and accept, no membership", async () => {
    const { app, tomek, link, preview, accept, members } = await setup();
    await db.pool.query("UPDATE invitation SET revoked_at = now() WHERE id = $1", [link.id]);

    expectInvalid(await preview());
    expectInvalid(await accept(tomek));
    expect(await members()).toEqual([]);
    await app.close();
  });

  it("a link older than 7 days: 410 on preview and accept", async () => {
    const { app, clock, tomek, preview, accept, members } = await setup();
    clock.set("2026-11-09T09:59:59.000Z");
    expect((await preview()).statusCode).toBe(200);

    clock.set("2026-11-10T10:00:00.000Z");
    expectInvalid(await preview());
    expectInvalid(await accept(tomek));
    expect(await members()).toEqual([]);
    await app.close();
  });

  it("two people accepting one link at the same time: exactly one joins, the other gets 410", async () => {
    const { app, tomek, ola, accept, members } = await setup();

    const responses = await Promise.all([accept(tomek), accept(ola)]);

    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 410]);
    expect(await members()).toHaveLength(1);
    await app.close();
  });
});
