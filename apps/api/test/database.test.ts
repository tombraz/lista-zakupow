import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { useTestDatabase } from "./database";

const journal = JSON.parse(
  readFileSync(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8"),
) as { entries: unknown[] };

describe("integration database harness", () => {
  const db = useTestDatabase();

  async function appliedMigrationCount(): Promise<number> {
    const table = await db.pool.query<{ name: string | null }>(
      "SELECT to_regclass('drizzle.__drizzle_migrations')::text AS name",
    );
    if (!table.rows[0]?.name) return 0;
    const { rows } = await db.pool.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations",
    );
    return rows[0]?.count ?? 0;
  }

  it("has every migration from the repository applied", async () => {
    const applied = await appliedMigrationCount();

    expect(journal.entries.length).toBeGreaterThan(0);
    expect(applied).toBe(journal.entries.length);
  });

  // Dwa takie same testy w dowolnej kolejności (także `--sequence.shuffle`, T-085): każdy zapisuje
  // wiersz i widzi tylko swój, więc ten, który wykona się drugi, pada, gdy czyszczenie nie działa.
  async function writeOneRowAndSeeOnlyIt(value: string) {
    await db.pool.query("CREATE TABLE IF NOT EXISTS isolation_probe (value text NOT NULL)");
    await db.pool.query("INSERT INTO isolation_probe (value) VALUES ($1)", [value]);

    const { rows } = await db.pool.query("SELECT value FROM isolation_probe");
    expect(rows).toEqual([{ value }]);
  }

  it("starts a test with empty tables (first probe)", async () => {
    await writeOneRowAndSeeOnlyIt("first probe");
  });

  it("starts a test with empty tables (second probe)", async () => {
    await writeOneRowAndSeeOnlyIt("second probe");
  });
});
