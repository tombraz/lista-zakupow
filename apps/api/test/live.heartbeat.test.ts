import { afterEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { createUser } from "./factories";
import { connectLive, liveUrl, pause } from "./live";

const TIMERS = ["setInterval", "clearInterval", "setTimeout", "clearTimeout"] as const;

describe("heartbeat (AC8)", () => {
  const db = useTestDatabase();
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    vi.useRealTimers();
    await app?.close();
    app = undefined;
  });

  async function connectedWithFakeClock() {
    app = buildTestApp(db.pool);
    const user = await createUser(app);
    const url = await liveUrl(app);
    vi.useFakeTimers({ toFake: [...TIMERS] });
    return connectLive(url, { cookie: user.cookie, keepPings: true });
  }

  it("pings every 25 s and keeps a connection that answers pong", async () => {
    const client = await connectedWithFakeClock();

    await vi.advanceTimersByTimeAsync(24_999);
    await client.expectSilence(50);
    await vi.advanceTimersByTimeAsync(1);
    expect(await client.next("ping")).toEqual({ type: "ping" });
    client.send({ type: "pong" });
    await pause(100);
    await vi.advanceTimersByTimeAsync(25_000);
    expect(await client.next("ping")).toEqual({ type: "ping" });
    client.send({ type: "pong" });
    await pause(100);
    await vi.advanceTimersByTimeAsync(10_000);

    await expect(client.closed(200)).rejects.toThrow("still open");
    client.close();
  });

  it("drops a connection that does not answer the ping within 10 s", async () => {
    const client = await connectedWithFakeClock();

    await vi.advanceTimersByTimeAsync(25_000);
    await client.next("ping");
    await vi.advanceTimersByTimeAsync(9_999);
    await expect(client.closed(100)).rejects.toThrow("still open");
    await vi.advanceTimersByTimeAsync(1);

    expect(await client.closed()).toBe(1006);
  });
});
