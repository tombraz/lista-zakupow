import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { addMember, createItem, createList, createUser, signIn } from "./factories";
import { connectLive, liveUrl, upgradeStatus } from "./live";
import { requestsAs } from "./requests";

// T-062 (F-04, F-14): usunięcie konta na żywo — gniazda konta, uczestnicy jego list i list cudzych.
describe("deleting an account live", () => {
  const db = useTestDatabase();
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  /** Ania: właścicielka „Dom” z Tomkiem, uczestniczka „Działka” Oli (tam jest Bartek). */
  async function households() {
    app = buildTestApp(db.pool);
    const ania = await createUser(app, { name: "Ania" });
    const tomek = await createUser(app, { name: "Tomek" });
    const ola = await createUser(app, { name: "Ola" });
    const bartek = await createUser(app, { name: "Bartek" });
    const home = await createList(db.pool, ania, "Dom");
    await addMember(db.pool, home, tomek);
    const plot = await createList(db.pool, ola, "Działka");
    await addMember(db.pool, plot, ania);
    await addMember(db.pool, plot, bartek);
    await createItem(db.pool, plot, ania, "Węgiel");
    return { app, url: await liveUrl(app), ania, tomek, ola, bartek, home, plot };
  }

  // SEC2 (TH-28): gniazda obu sesji konta zamknięte 1008, nowe połączenie z ciasteczkiem odrzucone.
  it("closes every socket of both sessions with 1008 and refuses a new connection", async () => {
    const { app, url, ania, ola, home } = await households();
    const phone = await signIn(app, ania);
    const sockets = [
      await connectLive(url, { cookie: ania.cookie }),
      await connectLive(url, { cookie: phone }),
    ];
    for (const socket of sockets) {
      socket.send({ type: "subscribe", listId: home.id });
      await socket.next("subscribed");
    }
    const olas = await connectLive(url, { cookie: ola.cookie });

    const response = await requestsAs(app, ania)("DELETE", "/api/v1/me", { confirm: true });

    expect(response.statusCode).toBe(204);
    for (const socket of sockets) expect(await socket.closed()).toBe(1008);
    for (const cookie of [ania.cookie, phone]) {
      expect(await upgradeStatus(url, { cookie })).toBe(401);
    }
    await expect(olas.closed(300)).rejects.toThrow("connection still open");
    olas.close();
  });

  // AC3: uczestnicy listy konta — `list.deleted` i `lists.changed`, potem już nic z tej listy.
  it("sends list.deleted and lists.changed to the participants of the account's lists", async () => {
    const { app, url, ania, tomek, home } = await households();
    const [watching, overview] = await Promise.all([
      connectLive(url, { cookie: tomek.cookie }),
      connectLive(url, { cookie: tomek.cookie }),
    ]);
    watching.send({ type: "subscribe", listId: home.id });
    await watching.next("subscribed");

    const response = await requestsAs(app, ania)("DELETE", "/api/v1/me", { confirm: true });

    expect(response.statusCode).toBe(204);
    expect(await watching.next("list.deleted")).toEqual({ type: "list.deleted", listId: home.id });
    await watching.next("lists.changed");
    await overview.next("lists.changed");
    watching.send({ type: "subscribe", listId: home.id });
    expect(await watching.next("error")).toEqual({
      type: "error",
      code: "not_found",
      listId: home.id,
    });
    for (const socket of [watching, overview]) socket.close();
  });

  // AC3: osoby z cudzej listy konta — `members.changed` (pozycje od nowa) i `lists.changed`.
  it("tells the other lists of the account members.changed and refreshes SC-05 of the people on them", async () => {
    const { app, url, ania, ola, bartek, plot } = await households();
    const [olas, barteks] = await Promise.all([
      connectLive(url, { cookie: ola.cookie }),
      connectLive(url, { cookie: bartek.cookie }),
    ]);
    for (const socket of [olas, barteks]) {
      socket.send({ type: "subscribe", listId: plot.id });
      await socket.next("subscribed");
    }

    const response = await requestsAs(app, ania)("DELETE", "/api/v1/me", { confirm: true });

    expect(response.statusCode).toBe(204);
    for (const socket of [olas, barteks]) {
      expect(await socket.next("members.changed")).toEqual({
        type: "members.changed",
        listId: plot.id,
      });
      await socket.next("lists.changed");
      expect(socket.received().map(({ type }) => type)).not.toContain("list.deleted");
      socket.close();
    }
  });
});
