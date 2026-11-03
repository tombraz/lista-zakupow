import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { addMember, createItem, createList, createUser } from "./factories";
import { connectLive, liveUrl } from "./live";
import { requestsAs } from "./requests";

// T-058 (F-13, MC-03): usunięcie uczestnika przez trasę właściciela na żywo.
describe("removing a participant live", () => {
  const db = useTestDatabase();
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  async function homeWithTomekWatching() {
    app = buildTestApp(db.pool);
    const ania = await createUser(app, { name: "Ania" });
    const tomek = await createUser(app, { name: "Tomek" });
    const list = await createList(db.pool, ania, "Dom");
    await addMember(db.pool, list, tomek);
    const url = await liveUrl(app);
    const tomeks = await connectLive(url, { cookie: tomek.cookie });
    tomeks.send({ type: "subscribe", listId: list.id });
    await tomeks.next("subscribed");
    return { app, url, ania, tomek, list, tomeks };
  }

  // SEC1 (TH-04): po `access.revoked` nic z listy; zapisy i odczyt listy 404.
  it("sends access.revoked, then no list event, and refuses the participant's writes and reads", async () => {
    const { app, ania, tomek, list, tomeks } = await homeWithTomekWatching();
    const milk = await createItem(db.pool, list, tomek, "Mleko");
    const asAnia = requestsAs(app, ania);
    const asTomek = requestsAs(app, tomek);

    const removal = await asAnia("DELETE", `/api/v1/lists/${list.id}/members/${tomek.id}`);
    expect(removal.statusCode).toBe(204);

    expect(await tomeks.next("access.revoked")).toEqual({
      type: "access.revoked",
      listId: list.id,
    });
    // Kanał domownika (SC-05), nie zdarzenie listy.
    await tomeks.next("lists.changed");
    await asAnia("POST", `/api/v1/lists/${list.id}/items`, { name: "Chleb" });
    await asAnia("PATCH", `/api/v1/lists/${list.id}`, { name: "Dom 2" });
    const refused = [
      await asTomek("POST", `/api/v1/lists/${list.id}/items`, { name: "Masło" }),
      await asTomek("PATCH", `/api/v1/lists/${list.id}/items/${milk.id}`, { checked: true }),
      await asTomek("GET", `/api/v1/lists/${list.id}`),
    ];
    for (const response of refused) {
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: { code: "not_found" } });
    }
    tomeks.send({ type: "subscribe", listId: list.id });
    expect(await tomeks.next("error")).toEqual({
      type: "error",
      code: "not_found",
      listId: list.id,
    });
    await tomeks.expectSilence();
    const types = tomeks.received().map(({ type }) => type);
    expect(types).not.toContain("item.upserted");
    expect(types).not.toContain("list.updated");
    tomeks.close();
  });

  // AC1: `members.changed` do listy (bez usuniętego), `lists.changed` do usuniętego i osób z dostępem.
  it("tells the list members.changed and refreshes SC-05 of the removed person and everyone left", async () => {
    const { app, url, ania, tomek, list, tomeks } = await homeWithTomekWatching();
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

    await requestsAs(app, ania)("DELETE", `/api/v1/lists/${list.id}/members/${tomek.id}`);

    for (const watcher of [anias, olas]) {
      expect(await watcher.next("members.changed")).toEqual({
        type: "members.changed",
        listId: list.id,
      });
      await watcher.next("lists.changed");
    }
    await aniasOtherTab.next("lists.changed");
    await tomeks.next("lists.changed");
    expect(tomeks.received().map(({ type }) => type)).toEqual([
      "subscribed",
      "access.revoked",
      "lists.changed",
    ]);
    for (const client of [anias, olas, aniasOtherTab, tomeks]) client.close();
  });
});
