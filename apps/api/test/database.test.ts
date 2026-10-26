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

    expect(journal.entries.length).toBe(1);
    expect(applied).toBe(journal.entries.length);
  });

  // Testy poniżej celowo zależą od kolejności: drugi sprawdza, że nie widzi danych pierwszego.
  it("lets a test write data", async () => {
    await db.pool.query("CREATE TABLE IF NOT EXISTS isolation_probe (value text NOT NULL)");
    await db.pool.query("INSERT INTO isolation_probe (value) VALUES ('from the previous test')");

    const { rows } = await db.pool.query("SELECT value FROM isolation_probe");
    expect(rows).toHaveLength(1);
  });

  it("starts the next test with empty tables", async () => {
    const { rows } = await db.pool.query("SELECT value FROM isolation_probe");

    expect(rows).toEqual([]);
  });
});
