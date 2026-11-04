import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { createList, createUser } from "./factories";
import { gatedPool } from "./gated-pool";
import { connectLive, liveUrl, type LiveClient } from "./live";

const TIMERS = ["setInterval", "clearInterval", "setTimeout", "clearTimeout"] as const;
const PING_MS = 25_000;

// SEC2 (TH-28): koniec sesji inny niż wylogowanie (wygaśnięcie, usunięcie wiersza) też kończy WS.
describe("live connection of an ended session (T-056, SEC2, TH-28)", () => {
  const db = useTestDatabase();
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    vi.useRealTimers();
    await app?.close();
    app = undefined;
  });

  const endings = {
    expired: "UPDATE session SET expires_at = now() - interval '1 second' WHERE user_id = $1",
    deleted: "DELETE FROM session WHERE user_id = $1",
  };

  for (const [ending, sql] of Object.entries(endings)) {
    it(`closes with 1008 on subscribe when the session was ${ending}`, async () => {
      app = buildTestApp(db.pool);
      const ania = await createUser(app);
      const list = await createList(db.pool, ania);
      const anias = await connectLive(await liveUrl(app), { cookie: ania.cookie });

      await db.pool.query(sql, [ania.id]);
      anias.send({ type: "subscribe", listId: list.id });

      expect(await anias.closed()).toBe(1008);
      expect(anias.received().map(({ type }) => type)).not.toContain("subscribed");
    });
  }

  async function answerPing(client: LiveClient) {
    await client.next("ping");
    client.send({ type: "pong" });
  }

  it("closes with 1008 at the next ping when the session expired without a subscribe", async () => {
    app = buildTestApp(db.pool);
    const ania = await createUser(app);
    const url = await liveUrl(app);
    vi.useFakeTimers({ toFake: [...TIMERS] });
    const anias = await connectLive(url, { cookie: ania.cookie, keepPings: true });

    await db.pool.query(endings.expired, [ania.id]);
    await vi.advanceTimersByTimeAsync(PING_MS - 1);
    await expect(anias.closed(200)).rejects.toThrow("still open");
    await vi.advanceTimersByTimeAsync(1);

    expect(await anias.closed()).toBe(1008);
  });

  it("checks each session at most once per ping and keeps pinging others while the database is slow (AC2)", async () => {
    const sessions = gatedPool(db.pool, /from "session"/);
    app = buildTestApp(sessions.pool);
    const people = [await createUser(app), await createUser(app)];
    const url = await liveUrl(app);
    vi.useFakeTimers({ toFake: [...TIMERS] });
    const clients = [];
    for (const { cookie } of people)
      clients.push(await connectLive(url, { cookie, keepPings: true }));
    const before = sessions.queries();
    const answeredBefore = sessions.answered();

    sessions.hold();
    await vi.advanceTimersByTimeAsync(PING_MS);
    for (const client of clients) await answerPing(client);
    await sessions.held(2);
    // `onPing` biegnie w tym samym wywołaniu co wysłanie pingu: odebrany ping to sygnał, że
    // serwer już zdecydował o zapytaniu (wolna baza nie wstrzymuje pingów, drugiego nie ma).
    await vi.advanceTimersByTimeAsync(PING_MS);
    for (const client of clients) await answerPing(client);
    expect(sessions.queries() - before).toBe(2);

    sessions.release();
    await vi.waitFor(() => {
      expect(sessions.answered() - answeredBefore).toBe(2);
    });
    await vi.advanceTimersByTimeAsync(PING_MS);
    for (const client of clients) await answerPing(client);
    expect(sessions.queries() - before).toBe(4);
    // Sesje aktywne: po wynikach kontroli połączenia zostają — dostają kolejny ping.
    await vi.waitFor(() => {
      expect(sessions.answered() - answeredBefore).toBe(4);
    });
    await vi.advanceTimersByTimeAsync(PING_MS);
    for (const client of clients) {
      await answerPing(client);
      client.close();
    }
  });
});
