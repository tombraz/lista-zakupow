import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLEANUP_START_DELAY_MS, scheduleCleanup } from "../src/cleanup";
import { buildTestApp } from "./app";
import { testClock } from "./clock";
import { useTestDatabase } from "./database";
import { captureLogs } from "./logs";

const START = new Date("2026-11-02T10:00:00.000Z");
const SECOND = 1000;
const HOUR = 60 * 60 * SECOND;
const DAY = 24 * HOUR;

// AC2: harmonogram w procesie API. Zegar domeny i timery podstawione; baza prawdziwa.
describe("cleanup schedule in the API process (AC2)", () => {
  const db = useTestDatabase();
  const clock = testClock(START.toISOString());
  let elapsed = 0;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    clock.set(START.toISOString());
    elapsed = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function startApi() {
    const logs = captureLogs();
    const app = buildTestApp(db.pool, { clock, logger: { level: "info", stream: logs.stream } });
    const schedule = scheduleCleanup(app, { pool: db.pool, clock });
    await app.ready();
    const runs = () => logs.entries().filter((entry) => entry["event"] === "cleanup").length;
    return { app, schedule, runs };
  }

  type Api = Awaited<ReturnType<typeof startApi>>;

  /** Upływ czasu: zegar domeny i timery razem, potem koniec rozpoczętego sprzątania. */
  async function elapse(ms: number, ...apis: Api[]) {
    elapsed += ms;
    clock.set(new Date(START.getTime() + elapsed).toISOString());
    await vi.advanceTimersByTimeAsync(ms);
    for (const api of apis) await api.schedule.settled();
  }

  async function lastRun(at: Date) {
    await db.pool.query("INSERT INTO cleanup_run (id, started_at) VALUES (1, $1)", [at]);
  }

  async function expiredSession() {
    const userId = randomUUID();
    await db.pool.query(`INSERT INTO "user" (id, name, email) VALUES ($1, 'Domownik', $2)`, [
      userId,
      `user-${userId}@example.com`,
    ]);
    await db.pool.query(
      "INSERT INTO session (id, user_id, token, expires_at) VALUES ($1, $2, $1, $3)",
      [randomUUID(), userId, new Date(START.getTime() - SECOND)],
    );
  }

  async function sessions() {
    const { rows } = await db.pool.query<{ count: string }>("SELECT count(*) FROM session");
    return Number(rows[0]?.count);
  }

  it("cleans up soon after start when it never ran", async () => {
    await expiredSession();
    const api = await startApi();

    await elapse(CLEANUP_START_DELAY_MS - SECOND, api);
    expect(api.runs()).toBe(0);
    await elapse(SECOND, api);

    expect(api.runs()).toBe(1);
    expect(await sessions()).toBe(0);
    await api.app.close();
  });

  it("starts soon after start: within a minute", () => {
    expect(CLEANUP_START_DELAY_MS).toBeGreaterThan(0);
    expect(CLEANUP_START_DELAY_MS).toBeLessThanOrEqual(60 * SECOND);
  });

  it("cleans up by itself every 24 h while the API runs", async () => {
    const api = await startApi();
    await elapse(CLEANUP_START_DELAY_MS, api);
    expect(api.runs()).toBe(1);

    await expiredSession();
    await elapse(DAY - SECOND, api);
    expect(api.runs()).toBe(1);
    await elapse(SECOND, api);

    expect(api.runs()).toBe(2);
    expect(await sessions()).toBe(0);
    await elapse(DAY, api);
    expect(api.runs()).toBe(3);
    await api.app.close();
  });

  it("catches up once after start when the last cleanup was over 24 h ago", async () => {
    // Staging uśpiony kilka dni: jedno sprzątanie po starcie, nie jedno za każdą dobę.
    await lastRun(new Date(START.getTime() - 3 * DAY));
    await expiredSession();
    const api = await startApi();

    await elapse(CLEANUP_START_DELAY_MS, api);
    expect(api.runs()).toBe(1);
    expect(await sessions()).toBe(0);
    await elapse(DAY - SECOND, api);

    expect(api.runs()).toBe(1);
    await api.app.close();
  });

  it("waits for 24 h since the last cleanup when it ran recently", async () => {
    await lastRun(new Date(START.getTime() - HOUR));
    const api = await startApi();

    await elapse(CLEANUP_START_DELAY_MS, api);
    expect(api.runs()).toBe(0);
    await elapse(23 * HOUR - CLEANUP_START_DELAY_MS - SECOND, api);
    expect(api.runs()).toBe(0);
    await elapse(SECOND, api);

    expect(api.runs()).toBe(1);
    await api.app.close();
  });

  it("never runs two cleanups at once, even from two API processes", async () => {
    // ADR 0003: jedna instancja, ale przy wdrożeniu stara i nowa mogą chwilę działać razem.
    const first = await startApi();
    const second = await startApi();

    await elapse(CLEANUP_START_DELAY_MS, first, second);

    expect(first.runs() + second.runs()).toBe(1);
    await first.app.close();
    await second.app.close();
  });

  it("stops when the API closes", async () => {
    const api = await startApi();
    await api.app.close();

    await elapse(CLEANUP_START_DELAY_MS + DAY, api);

    expect(api.runs()).toBe(0);
  });
});
