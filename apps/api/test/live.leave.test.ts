import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { addMember, createItem, createList, createUser } from "./factories";
import { connectLive, liveUrl } from "./live";
import { requestsAs } from "./requests";

// T-059 (F-13, MC-03): uczestnik opuszcza listę, a jego połączenia na żywo tracą do niej dostęp.
describe("leaving a list live", () => {
  const db = useTestDatabase();
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  /** Tomek ma listę „Dom” otwartą w dwóch kartach. */
  async function homeWithTomekWatchingTwice() {
    app = buildTestApp(db.pool);
    const ania = await createUser(app, { name: "Ania" });
    const tomek = await createUser(app, { name: "Tomek" });
    const list = await createList(db.pool, ania, "Dom");
    await addMember(db.pool, list, tomek);
    const url = await liveUrl(app);
    const tabs = await Promise.all([
      connectLive(url, { cookie: tomek.cookie }),
      connectLive(url, { cookie: tomek.cookie }),
    ]);
    for (const tab of tabs) {
      tab.send({ type: "subscribe", listId: list.id });
      await tab.next("subscribed");
    }
    return { app, url, ania, tomek, list, tabs };
  }

  // SEC1 (TH-04): po wyjściu żadne zdarzenie listy nie dociera do jego kart; zapis i odczyt 404.
  it("sends access.revoked to every tab of the participant, then no list event, and refuses writes and reads", async () => {
    const { app, ania, tomek, list, tabs } = await homeWithTomekWatchingTwice();
    const milk = await createItem(db.pool, list, tomek, "Mleko");
    const asAnia = requestsAs(app, ania);
    const asTomek = requestsAs(app, tomek);

    const leave = await asTomek("POST", `/api/v1/lists/${list.id}/leave`);
    expect(leave.statusCode).toBe(204);

    for (const tab of tabs) {
      expect(await tab.next("access.revoked")).toEqual({ type: "access.revoked", listId: list.id });
      await tab.next("lists.changed");
    }
    await asAnia("POST", `/api/v1/lists/${list.id}/items`, { name: "Chleb" });
    await asAnia("PATCH", `/api/v1/lists/${list.id}`, { name: "Dom 2" });
    const refused = [
      await asTomek("POST", `/api/v1/lists/${list.id}/items`, { name: "Masło" }),
      await asTomek("PATCH", `/api/v1/lists/${list.id}/items/${milk.id}`, { checked: true }),
      await asTomek("GET", `/api/v1/lists/${list.id}`),
      await asTomek("GET", `/api/v1/lists/${list.id}/members`),
      await asTomek("POST", `/api/v1/lists/${list.id}/leave`),
    ];
    for (const response of refused) {
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: { code: "not_found" } });
    }
    for (const tab of tabs) {
      tab.send({ type: "subscribe", listId: list.id });
      expect(await tab.next("error")).toEqual({
        type: "error",
        code: "not_found",
        listId: list.id,
      });
      await tab.expectSilence();
      const types = tab.received().map(({ type }) => type);
      expect(types).not.toContain("item.upserted");
      expect(types).not.toContain("list.updated");
      tab.close();
    }
  });

  // AC1: `members.changed` do listy, `lists.changed` do odchodzącego i do osób, które zostały.
  it("tells the list members.changed and refreshes SC-05 of the participant who left and of everyone left", async () => {
    const { app, url, ania, tomek, list, tabs } = await homeWithTomekWatchingTwice();
    const ola = await createUser(app, { name: "Ola" });
    await addMember(db.pool, list, ola);
    const [anias, olas, aniasOtherTab] = await Promise.all([
      connectLive(url, { cookie: ania.cookie }),
      connectLive(url, { cookie: ola.cookie }),
      connectLive(url, { cookie: ania.cookie }),
    ]);
    for (const watcher of [anias, olas]) {
      watcher.send({ type: "subscribe", listId: list.id });
      await watcher.next("subscribed");
    }

    await requestsAs(app, tomek)("POST", `/api/v1/lists/${list.id}/leave`);

    for (const watcher of [anias, olas]) {
      expect(await watcher.next("members.changed")).toEqual({
        type: "members.changed",
        listId: list.id,
      });
      await watcher.next("lists.changed");
    }
    await aniasOtherTab.next("lists.changed");
    for (const tab of tabs) {
      await tab.next("lists.changed");
      expect(tab.received().map(({ type }) => type)).toEqual([
        "subscribed",
        "access.revoked",
        "lists.changed",
      ]);
    }
    for (const client of [anias, olas, aniasOtherTab, ...tabs]) client.close();
  });
});
