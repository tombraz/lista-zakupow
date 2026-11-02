import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLEANUP_START_DELAY_MS, purgeExpiredData, scheduleCleanup } from "../src/cleanup";
import { buildTestApp } from "./app";
import { testClock } from "./clock";
import { useTestDatabase } from "./database";
import { gatedPool } from "./gated-pool";
import { captureLogs } from "./logs";

const START = new Date("2026-11-02T10:00:00.000Z");
const SECOND = 1000;
const DAY = 24 * 60 * 60 * SECOND;

// AC3: błąd bazy w trakcie sprzątania; usuwanie partiami. Baza prawdziwa: błąd to brak tabeli.
describe("cleanup failures and batches (AC3)", () => {
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
    const events = (event: string) => logs.entries().filter((entry) => entry["event"] === event);
    return { app, schedule, events };
  }

  async function elapse(ms: number, api: Awaited<ReturnType<typeof startApi>>) {
    elapsed += ms;
    clock.set(new Date(START.getTime() + elapsed).toISOString());
    await vi.advanceTimersByTimeAsync(ms);
    await api.schedule.settled();
  }

  async function expiredRows() {
    const userId = randomUUID();
    await db.pool.query(`INSERT INTO "user" (id, name, email) VALUES ($1, 'Domownik', $2)`, [
      userId,
      `user-${userId}@example.com`,
    ]);
    const expired = new Date(START.getTime() - SECOND);
    await db.pool.query(
      "INSERT INTO session (id, user_id, token, expires_at) VALUES ($1, $2, $1, $3)",
      [randomUUID(), userId, expired],
    );
    await db.pool.query(
      "INSERT INTO verification (id, identifier, value, expires_at) VALUES ($1, 'reset', $2, $3)",
      [randomUUID(), userId, expired],
    );
  }

  async function count(table: string) {
    const { rows } = await db.pool.query<{ count: string }>(`SELECT count(*) FROM ${table}`);
    return Number(rows[0]?.count);
  }

  async function withoutTable<T>(table: string, action: () => Promise<T>): Promise<T> {
    await db.pool.query(`ALTER TABLE ${table} RENAME TO ${table}_away`);
    try {
      return await action();
    } finally {
      await db.pool.query(`ALTER TABLE ${table}_away RENAME TO ${table}`);
    }
  }

  it("logs a failed table, cleans the others and keeps the API serving", async () => {
    await expiredRows();
    const api = await startApi();

    await withoutTable("verification", () => elapse(CLEANUP_START_DELAY_MS, api));

    expect(api.events("cleanup_failed")).toEqual([
      expect.objectContaining({ level: 50, table: "verification" }),
    ]);
    expect(await count("session")).toBe(0);
    expect(await count("verification")).toBe(1);
    const health = await api.app.inject({ method: "GET", url: "/health" });
    expect(health.statusCode).toBe(200);
    await api.app.close();
  });

  it("retries a failed table in the next cycle, 24 h later", async () => {
    await expiredRows();
    const api = await startApi();
    await withoutTable("verification", () => elapse(CLEANUP_START_DELAY_MS, api));

    await elapse(DAY - SECOND, api);
    expect(await count("verification")).toBe(1);
    await elapse(SECOND, api);

    expect(await count("verification")).toBe(0);
    await api.app.close();
  });

  it("survives a database error before cleaning and tries again in the next cycle", async () => {
    await expiredRows();
    const api = await startApi();

    await withoutTable("cleanup_run", () => elapse(CLEANUP_START_DELAY_MS, api));
    expect(api.events("cleanup_failed")).toHaveLength(1);
    expect(await count("session")).toBe(1);
    await elapse(DAY, api);

    expect(api.events("cleanup")).toHaveLength(1);
    expect(await count("session")).toBe(0);
    await api.app.close();
  });

  it("deletes in batches of 1000 rows", async () => {
    const userId = randomUUID();
    await db.pool.query(`INSERT INTO "user" (id, name, email) VALUES ($1, 'Domownik', $2)`, [
      userId,
      `user-${userId}@example.com`,
    ]);
    await db.pool.query(
      `INSERT INTO session (id, user_id, token, expires_at)
       SELECT 's-' || n, $1, 't-' || n, $2 FROM generate_series(1, 2500) AS n`,
      [userId, new Date(START.getTime() - SECOND)],
    );
    const counted = gatedPool(db.pool, /^DELETE FROM "session"/);

    const result = await purgeExpiredData(counted.pool, START);

    expect(result.deleted.session).toBe(2500);
    expect(counted.queries()).toBe(3);
  });
});
