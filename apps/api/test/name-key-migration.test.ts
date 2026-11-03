import { describe, expect, it } from "vitest";
import { runMigrations } from "../src/db/migrate";
import { useTestDatabase } from "./database";
import { createList, createUser } from "./factories";
import { buildTestApp } from "./app";

const ZWSP = String.fromCodePoint(0x200b);

// T-060 AC5: krok danych przelicza `item.name_key` nową regułą (NFKC, bez znaków ignorowalnych).
// Baza testu ma już migracje SQL; `DELETE` przed testem czyści też `data_migration`, więc
// `runMigrations` wykonuje krok na danych wstawionych z kluczami liczonymi starą regułą.
describe("data migration 0007_name_key_nfkc", () => {
  const db = useTestDatabase();

  async function setup() {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app);
    await app.close();
    return ania;
  }

  /** Pozycja z kluczem policzonym starą regułą (trim + NFC + lower), podanym wprost. */
  async function oldItem(listId: string, name: string, oldKey: string, createdAt: string) {
    const { rows } = await db.pool.query<{ id: string }>(
      `INSERT INTO item (id, list_id, name, name_key, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4) RETURNING id`,
      [listId, name, oldKey, createdAt],
    );
    const [row] = rows;
    if (!row) throw new Error("oldItem: no row");
    return row.id;
  }

  async function keys() {
    const { rows } = await db.pool.query<{ id: string; name: string; name_key: string }>(
      "SELECT id, name, name_key FROM item ORDER BY created_at",
    );
    return rows;
  }

  it("recomputes stale keys and leaves names unchanged", async () => {
    const ania = await setup();
    const list = await createList(db.pool, ania);
    await oldItem(list.id, "ｍｌｅｋｏ", "ｍｌｅｋｏ", "2026-10-01T10:00:00Z");
    await oldItem(list.id, "ﬁlet", "ﬁlet", "2026-10-01T10:01:00Z");
    await oldItem(list.id, `Chleb${ZWSP}`, `chleb${ZWSP}`, "2026-10-01T10:02:00Z");
    await oldItem(list.id, "Masło", "masło", "2026-10-01T10:03:00Z");

    await runMigrations(db.pool);

    expect((await keys()).map(({ name, name_key }) => [name, name_key])).toEqual([
      ["ｍｌｅｋｏ", "mleko"],
      ["ﬁlet", "filet"],
      [`Chleb${ZWSP}`, "chleb"],
      ["Masło", "masło"],
    ]);
  });

  it("keeps the key of the older item and gives the newer one a distinct key on a collision", async () => {
    const ania = await setup();
    const list = await createList(db.pool, ania);
    // Starsza ma stary klucz, który po przeliczeniu zajmie klucz nowszej (kolejność aktualizacji).
    await oldItem(list.id, "ｍｌｅｋｏ", "ｍｌｅｋｏ", "2026-10-01T10:00:00Z");
    const newer = await oldItem(list.id, "Mleko", "mleko", "2026-10-01T10:05:00Z");
    // Ten sam klucz w innej liście to nie kolizja.
    const other = await createList(db.pool, ania);
    await oldItem(other.id, `Mleko${ZWSP}`, `mleko${ZWSP}`, "2026-10-01T10:06:00Z");
    const messages: string[] = [];

    await runMigrations(db.pool, { log: (message) => messages.push(message) });

    expect((await keys()).map(({ name, name_key }) => [name, name_key])).toEqual([
      ["ｍｌｅｋｏ", "mleko"],
      ["Mleko", `mleko#${newer}`],
      [`Mleko${ZWSP}`, "mleko"],
    ]);
    expect(messages).toEqual(["data migration 0007_name_key_nfkc: 3 keys updated, 1 collisions"]);
  });

  it("recomputes keys across batches", async () => {
    const ania = await setup();
    const list = await createList(db.pool, ania);
    await db.pool.query(
      `INSERT INTO item (id, list_id, name, name_key, created_at)
       SELECT gen_random_uuid(), $1, 'ｍｌｅｋｏ ' || n, 'ｍｌｅｋｏ ' || n,
              timestamptz '2026-10-01T10:00:00Z' + n * interval '1 microsecond'
       FROM generate_series(1, 2500) AS n`,
      [list.id],
    );

    await runMigrations(db.pool);

    const { rows } = await db.pool.query(
      "SELECT count(*)::int AS stale FROM item WHERE name_key NOT LIKE 'mleko %'",
    );
    expect(rows).toEqual([{ stale: 0 }]);
  });

  it("runs the step once", async () => {
    const ania = await setup();
    const list = await createList(db.pool, ania);
    await runMigrations(db.pool);
    await oldItem(list.id, "ｍｌｅｋｏ", "ｍｌｅｋｏ", "2026-10-01T10:00:00Z");
    const messages: string[] = [];

    await runMigrations(db.pool, { log: (message) => messages.push(message) });

    expect((await keys()).map(({ name_key }) => name_key)).toEqual(["ｍｌｅｋｏ"]);
    expect(messages).toEqual([]);
    const { rows } = await db.pool.query("SELECT name FROM data_migration");
    expect(rows).toEqual([{ name: "0007_name_key_nfkc" }]);
  });
});
