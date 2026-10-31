import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { addMember, createInvitation, createList, createUser, type TestUser } from "./factories";
import { connectLive, liveUrl, type LiveClient } from "./live";
import { requestsAs } from "./requests";

describe("list, invitation and user channel events (AC2, F-05, F-11, F-12)", () => {
  const db = useTestDatabase();
  let app: FastifyInstance | undefined;
  const clients: LiveClient[] = [];

  afterEach(async () => {
    for (const client of clients.splice(0)) client.close();
    await app?.close();
    app = undefined;
  });

  async function household() {
    app = buildTestApp(db.pool);
    const ania = await createUser(app, { name: "Ania" });
    const tomek = await createUser(app, { name: "Tomek" });
    const cecylia = await createUser(app, { name: "Cecylia" });
    const list = await createList(db.pool, ania, "Dom");
    await addMember(db.pool, list, tomek);
    const url = await liveUrl(app);
    const connect = async (user: TestUser, subscribe: boolean) => {
      const client = await connectLive(url, { cookie: user.cookie });
      clients.push(client);
      if (subscribe) {
        client.send({ type: "subscribe", listId: list.id });
        await client.next("subscribed");
      }
      return client;
    };
    return { app, list, ania, tomek, cecylia, connect };
  }

  // T-032 (F-05, F-14): nowa lista pojawia się na SC-05 w innych kartach i urządzeniach właściciela.
  it("T-032: POST /lists notifies the owner with lists.changed", async () => {
    const { app, ania, connect } = await household();
    const aniasOtherTab = await connect(ania, false);

    const response = await requestsAs(app, ania)("POST", "/api/v1/lists", { name: "Działka" });

    expect(response.statusCode).toBe(201);
    expect(await aniasOtherTab.next("lists.changed")).toEqual({ type: "lists.changed" });
  });

  it("T-032: POST /lists sends nothing when refused", async () => {
    const { app, ania, connect } = await household();
    await db.pool.query(
      `INSERT INTO shopping_list (id, owner_id, name)
       SELECT gen_random_uuid(), $1, 'Lista ' || n FROM generate_series(1, 49) AS n`,
      [ania.id],
    );
    const anias = await connect(ania, false);
    const asAnia = requestsAs(app, ania);

    const overLimit = await asAnia("POST", "/api/v1/lists", { name: "51." });
    const invalid = await asAnia("POST", "/api/v1/lists", { name: "" });

    expect(overLimit.statusCode).toBe(409);
    expect(invalid.statusCode).toBe(400);
    await anias.expectSilence();
  });

  it("T-032: POST /lists does not notify other users (TH-04)", async () => {
    const { app, ania, tomek, cecylia, connect } = await household();
    const tomeks = await connect(tomek, false);
    const cecylias = await connect(cecylia, false);

    const response = await requestsAs(app, ania)("POST", "/api/v1/lists", { name: "Prezenty" });

    expect(response.statusCode).toBe(201);
    await tomeks.expectSilence();
    await cecylias.expectSilence();
  });

  it("rename: list.updated to subscribers and lists.changed to everyone with access", async () => {
    const { app, list, ania, tomek, connect } = await household();
    const tomeks = await connect(tomek, true);
    const anias = await connect(ania, false);

    const response = await requestsAs(app, ania)("PATCH", `/api/v1/lists/${list.id}`, {
      name: "Dom i działka",
    });

    expect(response.statusCode).toBe(200);
    expect(await tomeks.next("list.updated")).toEqual({
      type: "list.updated",
      listId: list.id,
      name: "Dom i działka",
    });
    await tomeks.next("lists.changed");
    await anias.next("lists.changed");
  });

  it("delete: list.deleted to subscribers and lists.changed to the former participants", async () => {
    const { app, list, ania, tomek, connect } = await household();
    const tomeks = await connect(tomek, true);
    const tomeksListsScreen = await connect(tomek, false);

    const response = await requestsAs(app, ania)("DELETE", `/api/v1/lists/${list.id}`);

    expect(response.statusCode).toBe(204);
    expect(await tomeks.next("list.deleted")).toEqual({ type: "list.deleted", listId: list.id });
    await tomeksListsScreen.next("lists.changed");
  });

  it("accepting a link: members.changed, invitations.changed to the owner, lists.changed to all and the newcomer", async () => {
    const { app, list, ania, tomek, cecylia, connect } = await household();
    const invitation = await createInvitation(db.pool, list);
    const tomeks = await connect(tomek, true);
    const anias = await connect(ania, false);
    const cecylias = await connect(cecylia, false);

    const response = await requestsAs(app, cecylia)(
      "POST",
      `/api/v1/invitations/${invitation.token}/accept`,
    );

    expect(response.statusCode).toBe(200);
    expect(await tomeks.next("members.changed")).toEqual({
      type: "members.changed",
      listId: list.id,
    });
    expect(await anias.next("invitations.changed")).toEqual({
      type: "invitations.changed",
      listId: list.id,
    });
    await anias.next("lists.changed");
    await tomeks.next("lists.changed");
    await cecylias.next("lists.changed");
    expect(tomeks.received().map(({ type }) => type)).not.toContain("invitations.changed");
  });

  it("accepting a link while signing up announces the newcomer too", async () => {
    const { app, list, ania, connect } = await household();
    const invitation = await createInvitation(db.pool, list);
    const anias = await connect(ania, true);

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      headers: { origin: "http://localhost:5173" },
      payload: {
        name: "Cecylia",
        email: `cecylia-${list.id}@example.com`,
        password: "dobre-haslo-1",
        termsAccepted: true,
        ageConfirmed: true,
        invitationToken: invitation.token,
      },
    });

    expect(response.json()).toMatchObject({ invitation: { listId: list.id } });
    await anias.next("members.changed");
    await anias.next("invitations.changed");
  });

  it("revoking a link: invitations.changed to the owner only", async () => {
    const { app, list, ania, tomek, connect } = await household();
    const invitation = await createInvitation(db.pool, list);
    const anias = await connect(ania, true);
    const tomeks = await connect(tomek, true);

    const response = await requestsAs(app, ania)(
      "DELETE",
      `/api/v1/lists/${list.id}/invitations/${invitation.id}`,
    );

    expect(response.statusCode).toBe(204);
    expect(await anias.next("invitations.changed")).toEqual({
      type: "invitations.changed",
      listId: list.id,
    });
    await tomeks.expectSilence();
  });
});
