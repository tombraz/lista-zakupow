import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { LIVE_LIMITS } from "@lista/shared";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { createList, createUser } from "./factories";
import { closeCode, closeWithoutFin, connectLive, liveUrl, pause, type LiveClient } from "./live";
import { captureLogs } from "./logs";

describe("WebSocket limits (SEC6, TH-25)", () => {
  const db = useTestDatabase();
  let app: FastifyInstance | undefined;
  const clients: LiveClient[] = [];
  const sockets: (() => void)[] = [];

  afterEach(async () => {
    for (const client of clients.splice(0)) client.close();
    for (const destroy of sockets.splice(0)) destroy();
    await app?.close();
    app = undefined;
  });

  async function connected() {
    const logs = captureLogs();
    app = buildTestApp(db.pool, { logger: { level: "info", stream: logs.stream } });
    const user = await createUser(app);
    const url = await liveUrl(app);
    const connect = async () => {
      const client = await connectLive(url, { cookie: user.cookie });
      clients.push(client);
      return client;
    };
    return { user, url, connect, logs };
  }

  // T-033 (TH-21, TH-25): przekroczenie limitu zostawia ślad w logu `security`, bez ciasteczka.
  function limitEvents(logs: ReturnType<typeof captureLogs>, cookie: string) {
    expect(logs.lines.join("\n")).not.toContain(cookie.split("=")[1] ?? cookie);
    return logs
      .security()
      .filter((entry) => entry["event"] === "limit_reached" || entry["event"] === "rate_limited");
  }

  it("closes a connection over the per-session limit and keeps the others", async () => {
    const { connect } = await connected();
    const allowed = [];
    for (let i = 0; i < LIVE_LIMITS.connectionsPerSession; i += 1) allowed.push(await connect());

    const extra = await connect();

    expect(await extra.closed()).toBe(1008);
    for (const client of allowed) await expect(client.closed(100)).rejects.toThrow("still open");
  });

  it("frees a slot when a connection closes", async () => {
    const { connect } = await connected();
    const first = await connect();
    for (let i = 1; i < LIVE_LIMITS.connectionsPerSession; i += 1) await connect();
    first.close();
    await first.closed();

    const next = await connect();

    await expect(next.closed(200)).rejects.toThrow("still open");
  });

  // T-036: `ws` zgłasza `close` serwera dopiero po zamknięciu TCP; klient mógł połączyć się wcześniej.
  it("frees a slot when the closing handshake ends, before TCP closes", async () => {
    const { user, url, connect } = await connected();
    sockets.push(await closeWithoutFin(url, { cookie: user.cookie }));
    for (let i = 1; i < LIVE_LIMITS.connectionsPerSession; i += 1) await connect();

    const next = await connect();

    await expect(next.closed(200)).rejects.toThrow("still open");
  });

  // T-037 (TH-25): klient bez FIN trzyma zamykane gniazda; limit liczy je razem z otwartymi.
  it("drops a socket over the per-session socket limit, counting closing ones", async () => {
    const { user, url, logs } = await connected();
    for (let i = 0; i < LIVE_LIMITS.socketsPerSession; i += 1)
      sockets.push(await closeWithoutFin(url, { cookie: user.cookie }));

    expect(await closeCode(url, { cookie: user.cookie })).toBe(1006);
    expect(limitEvents(logs, user.cookie)).toEqual([
      expect.objectContaining({
        event: "limit_reached",
        limit: "socketsPerSession",
        userId: user.id,
      }),
    ]);
  });

  it("releases closing sockets after the close timeout", async () => {
    const { user, url, connect } = await connected();
    for (let i = 0; i < LIVE_LIMITS.socketsPerSession; i += 1)
      sockets.push(await closeWithoutFin(url, { cookie: user.cookie }));
    await pause(LIVE_LIMITS.closeTimeoutSeconds * 1000 + 300);

    const next = await connect();

    await expect(next.closed(200)).rejects.toThrow("still open");
  });

  it("closes a connection that sends more messages per second than the limit", async () => {
    const { connect } = await connected();
    const client = await connect();

    for (let i = 0; i <= LIVE_LIMITS.messagesPerSecond; i += 1) client.send({ type: "pong" });

    expect(await client.closed()).toBe(1008);
  });

  it("accepts messages at the limit", async () => {
    const { connect } = await connected();
    const client = await connect();

    for (let i = 0; i < LIVE_LIMITS.messagesPerSecond; i += 1) client.send({ type: "pong" });

    await expect(client.closed(300)).rejects.toThrow("still open");
  });

  it("closes a connection that sends a message over the size limit", async () => {
    const { connect } = await connected();
    const client = await connect();

    client.send({ type: "subscribe", listId: "x".repeat(LIVE_LIMITS.messageBytes) });

    expect(await client.closed()).toBe(1009);
  });

  it("answers a message outside the schema with error and no effect", async () => {
    const { user, connect } = await connected();
    const list = await createList(db.pool, user);
    const client = await connect();

    client.send("not json");
    client.send({ type: "subscribe", listId: list.id, extra: true });
    client.send({ type: "publish", listId: list.id });

    for (let i = 0; i < 3; i += 1) {
      expect(await client.next("error")).toEqual({ type: "error", code: "validation_failed" });
    }
    await client.expectSilence();
    expect(client.received().map(({ type }) => type)).not.toContain("subscribed");
  });

  it("logs limit_reached when a session exceeds the connection limit", async () => {
    const { user, connect, logs } = await connected();
    for (let i = 0; i < LIVE_LIMITS.connectionsPerSession; i += 1) await connect();

    const extra = await connect();

    expect(await extra.closed()).toBe(1008);
    expect(limitEvents(logs, user.cookie)).toEqual([
      expect.objectContaining({
        event: "limit_reached",
        limit: "connectionsPerSession",
        userId: user.id,
      }),
    ]);
  });

  it("logs rate_limited when a connection exceeds the message rate", async () => {
    const { user, connect, logs } = await connected();
    const client = await connect();

    for (let i = 0; i <= LIVE_LIMITS.messagesPerSecond + 5; i += 1) client.send({ type: "pong" });

    expect(await client.closed()).toBe(1008);
    expect(limitEvents(logs, user.cookie)).toEqual([
      expect.objectContaining({
        event: "rate_limited",
        limit: "messagesPerSecond",
        userId: user.id,
      }),
    ]);
  });

  it("logs limit_reached when a message exceeds the size limit", async () => {
    const { user, connect, logs } = await connected();
    const client = await connect();

    client.send({ type: "subscribe", listId: "x".repeat(LIVE_LIMITS.messageBytes) });

    expect(await client.closed()).toBe(1009);
    expect(limitEvents(logs, user.cookie)).toEqual([
      expect.objectContaining({ event: "limit_reached", limit: "messageBytes", userId: user.id }),
    ]);
  });
});
