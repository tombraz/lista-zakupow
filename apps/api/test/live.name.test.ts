import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { addMember, createList, createUser } from "./factories";
import { connectLive, liveUrl } from "./live";
import { requestsAs } from "./requests";

// T-061 AC3 (F-16, F-14): nowe imię u osób z otwartą listą (SC-06, SC-07) i na ich SC-05.
// Pozycje niosą `addedBy.name`, a `updatedAt` pozycji się nie zmienia, więc klient pobiera listę
// ponownie po `members.changed` (zamiast zdarzeń pozycji, które by zignorował).
describe("changing the name live", () => {
  const db = useTestDatabase();
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("sends members.changed to every list of the person and lists.changed once to everyone with access", async () => {
    app = buildTestApp(db.pool);
    const ania = await createUser(app, { name: "Ania" });
    const tomek = await createUser(app, { name: "Tomek" });
    const ola = await createUser(app, { name: "Ola" });
    const ewa = await createUser(app, { name: "Ewa" });
    const home = await createList(db.pool, ania, "Dom");
    await addMember(db.pool, home, tomek);
    await addMember(db.pool, home, ola);
    const garden = await createList(db.pool, tomek, "Działka");
    await addMember(db.pool, garden, ola);
    const elsewhere = await createList(db.pool, ewa, "Biuro");
    await addMember(db.pool, elsewhere, ania);
    const url = await liveUrl(app);
    const [anias, olas, tomeks, ewas] = await Promise.all([
      connectLive(url, { cookie: ania.cookie }),
      connectLive(url, { cookie: ola.cookie }),
      connectLive(url, { cookie: tomek.cookie }),
      connectLive(url, { cookie: ewa.cookie }),
    ]);
    const watching: [typeof anias, string][] = [
      [anias, home.id],
      [anias, elsewhere.id],
      [olas, home.id],
      [olas, garden.id],
      [ewas, elsewhere.id],
    ];
    for (const [client, listId] of watching) {
      client.send({ type: "subscribe", listId });
      await client.next("subscribed");
    }

    const response = await requestsAs(app, tomek)("PATCH", "/api/v1/me", { name: "Tomasz" });
    expect(response.statusCode).toBe(200);

    expect(await anias.next("members.changed")).toEqual({
      type: "members.changed",
      listId: home.id,
    });
    await anias.next("lists.changed");
    const olaHeard = [await olas.next("members.changed"), await olas.next("members.changed")];
    expect(olaHeard.map((event) => (event as { listId: string }).listId).sort()).toEqual(
      [home.id, garden.id].sort(),
    );
    await olas.next("lists.changed");
    await tomeks.next("lists.changed");
    for (const client of [anias, olas, tomeks, ewas]) await client.expectSilence();
    const types = (client: typeof anias) => client.received().map(({ type }) => type);
    expect(types(anias).filter((type) => type === "lists.changed")).toHaveLength(1);
    expect(types(olas).filter((type) => type === "lists.changed")).toHaveLength(1);
    expect(anias.received()).not.toContainEqual({
      type: "members.changed",
      listId: elsewhere.id,
    });
    expect(types(ewas)).toEqual(["subscribed"]);
    for (const client of [anias, olas, tomeks, ewas]) client.close();
  });

  it("changes the name of a person without lists without any event", async () => {
    app = buildTestApp(db.pool);
    const tomek = await createUser(app, { name: "Tomek" });
    const ewa = await createUser(app, { name: "Ewa" });
    const url = await liveUrl(app);
    const ewas = await connectLive(url, { cookie: ewa.cookie });

    const response = await requestsAs(app, tomek)("PATCH", "/api/v1/me", { name: "Tomasz" });

    expect(response.statusCode).toBe(200);
    await ewas.expectSilence();
    expect(ewas.received()).toEqual([]);
    ewas.close();
  });
});
