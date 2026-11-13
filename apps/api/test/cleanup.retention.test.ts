import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { purgeExpiredData } from "../src/cleanup";
import { useTestDatabase } from "./database";

// Terminy z inwentarza danych (data-model.md) i AC1 T-064; granice ± 1 s / 1 dzień.
const NOW = new Date("2026-11-02T10:00:00.000Z");
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs);

async function insertUser(pool: Pool): Promise<string> {
  const id = randomUUID();
  await pool.query(`INSERT INTO "user" (id, name, email) VALUES ($1, 'Domownik', $2)`, [
    id,
    `user-${id}@example.com`,
  ]);
  return id;
}

async function insertList(pool: Pool, ownerId: string): Promise<string> {
  const id = randomUUID();
  await pool.query(`INSERT INTO shopping_list (id, owner_id, name) VALUES ($1, $2, 'Zakupy')`, [
    id,
    ownerId,
  ]);
  return id;
}

async function remaining(pool: Pool, query: string): Promise<string[]> {
  const { rows } = await pool.query<{ label: string }>(query);
  return rows.map((row) => row.label).sort();
}

describe("purgeExpiredData (AC1, SEC1: TH-27)", () => {
  const db = useTestDatabase();

  it("deletes sessions past expires_at and keeps the rest", async () => {
    const userId = await insertUser(db.pool);
    for (const [label, expiresAt] of [
      ["expired", at(-SECOND)],
      ["valid", at(SECOND)],
    ] as const) {
      await db.pool.query(
        "INSERT INTO session (id, user_id, token, expires_at) VALUES ($1, $2, $3, $4)",
        [label, userId, `token-${label}`, expiresAt],
      );
    }

    const result = await purgeExpiredData(db.pool, NOW);

    expect(await remaining(db.pool, "SELECT id AS label FROM session")).toEqual(["valid"]);
    expect(result.deleted.session).toBe(1);
  });

  it("deletes invitations 30 days after they expired, also used and revoked ones", async () => {
    const listId = await insertList(db.pool, await insertUser(db.pool));
    const rows = [
      ["expired-31d", at(-30 * DAY - SECOND), null, null],
      ["used-31d", at(-30 * DAY - SECOND), at(-37 * DAY), null],
      ["revoked-31d", at(-30 * DAY - SECOND), null, at(-37 * DAY)],
      ["expired-29d", at(-30 * DAY + SECOND), null, null],
      ["used-29d", at(-30 * DAY + SECOND), at(-36 * DAY), null],
      ["active", at(DAY), null, null],
    ] as const;
    for (const [label, expiresAt, usedAt, revokedAt] of rows) {
      await db.pool.query(
        `INSERT INTO invitation (id, list_id, token, expires_at, used_at, revoked_at, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $3::timestamptz - interval '7 days')`,
        [listId, label, expiresAt, usedAt, revokedAt],
      );
    }

    const result = await purgeExpiredData(db.pool, NOW);

    expect(await remaining(db.pool, "SELECT token AS label FROM invitation")).toEqual([
      "active",
      "expired-29d",
      "used-29d",
    ]);
    expect(result.deleted.invitation).toBe(3);
  });

  it("deletes daily activity older than 90 days (Europe/Warsaw day)", async () => {
    const userId = await insertUser(db.pool);
    const listId = await insertList(db.pool, userId);
    // NOW = 2026-11-02 11:00 w Warszawie; 90 dni wcześniej = 2026-08-04.
    for (const day of ["2026-08-03", "2026-08-04", "2026-11-02"]) {
      await db.pool.query(
        "INSERT INTO list_daily_activity (list_id, day, user_id, checks) VALUES ($1, $2, $3, 3)",
        [listId, day, userId],
      );
    }

    const result = await purgeExpiredData(db.pool, NOW);

    expect(
      await remaining(
        db.pool,
        "SELECT to_char(day, 'YYYY-MM-DD') AS label FROM list_daily_activity",
      ),
    ).toEqual(["2026-08-04", "2026-11-02"]);
    expect(result.deleted.list_daily_activity).toBe(1);
  });

  it("counts the activity day in Europe/Warsaw, not UTC", async () => {
    const userId = await insertUser(db.pool);
    const listId = await insertList(db.pool, userId);
    // 2026-11-02 23:30 UTC to już 3 listopada w Warszawie: 90 dni wcześniej = 2026-08-05.
    for (const day of ["2026-08-04", "2026-08-05"]) {
      await db.pool.query(
        "INSERT INTO list_daily_activity (list_id, day, user_id, checks) VALUES ($1, $2, $3, 3)",
        [listId, day, userId],
      );
    }

    await purgeExpiredData(db.pool, new Date("2026-11-02T23:30:00.000Z"));

    expect(
      await remaining(
        db.pool,
        "SELECT to_char(day, 'YYYY-MM-DD') AS label FROM list_daily_activity",
      ),
    ).toEqual(["2026-08-05"]);
  });

  it("deletes expired password reset tokens", async () => {
    for (const [label, expiresAt] of [
      ["expired", at(-SECOND)],
      ["valid", at(SECOND)],
    ] as const) {
      await db.pool.query(
        "INSERT INTO verification (id, identifier, value, expires_at) VALUES ($1, $2, 'user-id', $3)",
        [label, `reset-password:${label}`, expiresAt],
      );
    }

    const result = await purgeExpiredData(db.pool, NOW);

    expect(await remaining(db.pool, "SELECT id AS label FROM verification")).toEqual(["valid"]);
    expect(result.deleted.verification).toBe(1);
  });

  it("deletes rate limit counters whose longest window (1 h) has passed", async () => {
    for (const [label, lastRequest] of [
      ["passed", at(-HOUR - SECOND)],
      ["open", at(-HOUR + SECOND)],
    ] as const) {
      await db.pool.query(
        "INSERT INTO rate_limit (id, key, count, last_request) VALUES ($1, $1, 1, $2)",
        [label, lastRequest.getTime()],
      );
    }

    const result = await purgeExpiredData(db.pool, NOW);

    expect(await remaining(db.pool, "SELECT key AS label FROM rate_limit")).toEqual(["open"]);
    expect(result.deleted.rate_limit).toBe(1);
  });

  it("deletes sign-in failure counters after their 15 min window (SEC1: TH-27)", async () => {
    for (const [label, windowStartedAt] of [
      ["passed", at(-15 * MINUTE - SECOND)],
      ["open", at(-15 * MINUTE + SECOND)],
    ] as const) {
      await db.pool.query(
        "INSERT INTO sign_in_failure (account_key, failures, window_started_at) VALUES ($1, 5, $2)",
        [label, windowStartedAt],
      );
    }

    const result = await purgeExpiredData(db.pool, NOW);

    expect(await remaining(db.pool, "SELECT account_key AS label FROM sign_in_failure")).toEqual([
      "open",
    ]);
    expect(result.deleted.sign_in_failure).toBe(1);
  });

  it("deletes daily reset mail counters after their 24 h window (T-120: TH-27)", async () => {
    for (const [label, windowStartedAt] of [
      ["passed", at(-DAY - SECOND)],
      ["open", at(-DAY + SECOND)],
    ] as const) {
      await db.pool.query(
        "INSERT INTO mail_quota (key, count, window_started_at) VALUES ($1, 10, $2)",
        [label, windowStartedAt],
      );
    }

    const result = await purgeExpiredData(db.pool, NOW);

    expect(await remaining(db.pool, "SELECT key AS label FROM mail_quota")).toEqual(["open"]);
    expect(result.deleted.mail_quota).toBe(1);
  });

  it("keeps the number of pre-sign-in rows bounded over time (SEC1: TH-27)", async () => {
    // Codziennie nowe liczniki z innych kont i adresów; po każdym sprzątaniu zostają tylko świeże.
    for (let day = 0; day < 5; day += 1) {
      const now = at(day * DAY);
      await db.pool.query(
        `INSERT INTO sign_in_failure (account_key, failures, window_started_at)
         SELECT 'day-' || $1 || '-' || n, 1, $2::timestamptz - (n || ' minutes')::interval
         FROM generate_series(1, 50) AS n`,
        [day, now],
      );
      await db.pool.query(
        `INSERT INTO rate_limit (id, key, count, last_request)
         SELECT 'day-' || $1 || '-' || n, 'day-' || $1 || '-' || n, 1, $2::bigint - n * 60000
         FROM generate_series(1, 120) AS n`,
        [day, now.getTime()],
      );
      await purgeExpiredData(db.pool, now);
    }

    const { rows } = await db.pool.query<{ failures: string; limits: string }>(
      `SELECT (SELECT count(*) FROM sign_in_failure) AS failures,
              (SELECT count(*) FROM rate_limit) AS limits`,
    );
    // Ostatni dzień: liczniki z okna 15 min (minuty 1–15) i 1 h (minuty 1–60; granica okna należy do niego).
    expect(rows[0]).toEqual({ failures: "15", limits: "60" });
  });

  it("keeps all other data", async () => {
    const userId = await insertUser(db.pool);
    const listId = await insertList(db.pool, userId);
    await db.pool.query(
      `INSERT INTO item (id, list_id, name, name_key, added_by, created_at)
       VALUES (gen_random_uuid(), $1, 'Mleko', 'mleko', $2, $3)`,
      [listId, userId, at(-400 * DAY)],
    );

    await purgeExpiredData(db.pool, NOW);

    const { rows } = await db.pool.query<{ users: string; lists: string; items: string }>(
      `SELECT (SELECT count(*) FROM "user") AS users, (SELECT count(*) FROM shopping_list) AS lists,
              (SELECT count(*) FROM item) AS items`,
    );
    expect(rows[0]).toEqual({ users: "1", lists: "1", items: "1" });
  });
});
