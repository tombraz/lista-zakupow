import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLEANUP_START_DELAY_MS, scheduleCleanup } from "../src/cleanup";
import { buildTestApp } from "./app";
import { testClock } from "./clock";
import { useTestDatabase } from "./database";
import { captureLogs } from "./logs";

const START = new Date("2026-11-02T10:00:00.000Z");
const LONG_AGO = new Date("2026-01-01T10:00:00.000Z");
const TABLES = [
  "invitation",
  "list_daily_activity",
  "rate_limit",
  "session",
  "sign_in_failure",
  "verification",
];
// Pola każdego wpisu pino (`logging.ts`) plus pola wyniku sprzątania; nic więcej.
const ENTRY_FIELDS = ["level", "time", "pid", "hostname", "msg", "event"];

// SEC2 (TH-21): wynik sprzątania w logu to nazwy tabel i liczby, bez danych osób i tokenów.
describe("cleanup log (SEC2: TH-21)", () => {
  const db = useTestDatabase();
  const clock = testClock(START.toISOString());

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    clock.set(START.toISOString());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Wiersze po terminie w każdej tabeli, z rozpoznawalnymi wartościami do szukania w logu. */
  async function expiredRowsWithMarkers(): Promise<string[]> {
    const marker = () => `marker${randomUUID().replaceAll("-", "")}`;
    const userId = marker();
    const email = `${marker()}@example.com`;
    const listId = randomUUID();
    const markers = {
      sessionToken: marker(),
      userAgent: marker(),
      resetToken: marker(),
      invitationToken: marker(),
      accountKey: marker(),
      rateLimitKey: `203.0.113.77${marker()}`,
    };
    await db.pool.query(`INSERT INTO "user" (id, name, email) VALUES ($1, 'Domownik', $2)`, [
      userId,
      email,
    ]);
    await db.pool.query(
      `INSERT INTO shopping_list (id, owner_id, name) VALUES ($1, $2, 'Zakupy')`,
      [listId, userId],
    );
    await db.pool.query(
      `INSERT INTO session (id, user_id, token, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $1, $3, '203.0.113.77', $4)`,
      [markers.sessionToken, userId, LONG_AGO, markers.userAgent],
    );
    await db.pool.query(
      "INSERT INTO verification (id, identifier, value, expires_at) VALUES ($1, $1, $2, $3)",
      [markers.resetToken, userId, LONG_AGO],
    );
    await db.pool.query(
      `INSERT INTO invitation (id, list_id, token, expires_at, used_by, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $3)`,
      [listId, markers.invitationToken, LONG_AGO, userId],
    );
    await db.pool.query(
      "INSERT INTO list_daily_activity (list_id, day, user_id, checks) VALUES ($1, '2026-01-01', $2, 3)",
      [listId, userId],
    );
    await db.pool.query(
      "INSERT INTO sign_in_failure (account_key, failures, window_started_at) VALUES ($1, 5, $2)",
      [markers.accountKey, LONG_AGO],
    );
    await db.pool.query(
      "INSERT INTO rate_limit (id, key, count, last_request) VALUES ($1, $1, 3, $2)",
      [markers.rateLimitKey, LONG_AGO.getTime()],
    );
    return [userId, email, listId, "203.0.113.77", ...Object.values(markers)];
  }

  async function cleanUpOnce() {
    const logs = captureLogs();
    const app = buildTestApp(db.pool, { clock, logger: { level: "trace", stream: logs.stream } });
    const schedule = scheduleCleanup(app, { pool: db.pool, clock });
    await app.ready();
    await vi.advanceTimersByTimeAsync(CLEANUP_START_DELAY_MS);
    await schedule.settled();
    await app.close();
    return logs;
  }

  it("logs only table names and row counts", async () => {
    const markers = await expiredRowsWithMarkers();

    const logs = await cleanUpOnce();

    const [entry, ...others] = logs.entries().filter((line) => line["event"] === "cleanup");
    expect(others).toEqual([]);
    expect(Object.keys(entry ?? {}).sort()).toEqual([...ENTRY_FIELDS, "deleted"].sort());
    expect(entry?.["deleted"]).toEqual(Object.fromEntries(TABLES.map((table) => [table, 1])));
    for (const value of markers) {
      expect(logs.lines.filter((line) => line.includes(value))).toEqual([]);
    }
  });

  it("logs a failed table without the query, its parameters or the error message", async () => {
    const markers = await expiredRowsWithMarkers();
    await db.pool.query("ALTER TABLE session RENAME TO session_away");

    const logs = await cleanUpOnce().finally(() =>
      db.pool.query("ALTER TABLE session_away RENAME TO session"),
    );

    const failures = logs.entries().filter((line) => line["event"] === "cleanup_failed");
    expect(failures).toHaveLength(1);
    const [failure] = failures;
    expect(Object.keys(failure ?? {}).sort()).toEqual([...ENTRY_FIELDS, "table", "err"].sort());
    expect(failure?.["table"]).toBe("session");
    // Typ, kod i ramki stosu (`errorSummary`), także przyczyny; bez komunikatu z SQL.
    const err = failure?.["err"] as { cause?: object };
    expect(Object.keys(err).sort()).toEqual(["cause", "stack", "type"]);
    expect(Object.keys(err.cause ?? {}).sort()).toEqual(["code", "stack", "type"]);
    expect(logs.lines.filter((line) => line.includes("DELETE"))).toEqual([]);
    for (const value of markers) {
      expect(logs.lines.filter((line) => line.includes(value))).toEqual([]);
    }
  });
});
