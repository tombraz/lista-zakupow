import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { LIVE_LIMITS } from "@lista/shared";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { createList, createUser } from "./factories";
import { connectLive, liveUrl, type LiveClient } from "./live";

describe("WebSocket limits (SEC6, TH-25)", () => {
  const db = useTestDatabase();
  let app: FastifyInstance | undefined;
  const clients: LiveClient[] = [];

  afterEach(async () => {
    for (const client of clients.splice(0)) client.close();
    await app?.close();
    app = undefined;
  });

  async function connected() {
    app = buildTestApp(db.pool);
    const user = await createUser(app);
    const url = await liveUrl(app);
    const connect = async () => {
      const client = await connectLive(url, { cookie: user.cookie });
      clients.push(client);
      return client;
    };
    return { user, connect };
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
});
