import { normalizeItemName } from "@lista/shared";
import type { PoolClient } from "pg";
import type { DataMigration } from "./data-migration";

const BATCH_SIZE = 1000;
const UNIQUE_KEY = "item_list_id_name_key_unique";

interface ItemRow {
  id: string;
  list_id: string;
  name: string;
  name_key: string;
  created_at: string;
}

/**
 * T-060 AC5: `item.name_key` przeliczony nową regułą `normalizeItemName` (NFKC, bez znaków
 * ignorowalnych). Nazwy pozycji, imiona i nazwy list zostają bez zmian.
 *
 * Kolizja (dwie pozycje listy z tym samym nowym kluczem): starsza (`created_at`, potem `id`)
 * dostaje klucz, nowsza `<klucz>#<id>`, więc obie zostają, a nowa pozycja o tej nazwie to duplikat.
 * Unikalność wyłączona na czas przeliczenia: nowy klucz jednej pozycji może chwilowo równać się
 * jeszcze nieprzeliczonemu kluczowi innej.
 *
 * `down` (ręcznie, migracje są tylko do przodu): stary klucz = `trim` + NFC +
 * `toLocaleLowerCase('pl-PL')` z `name`, liczony tym samym sposobem (krok TS), kolizje tak samo,
 * i usunięcie wiersza `0007_name_key_nfkc` z `data_migration`.
 */
export const nameKeyNfkc: DataMigration = {
  name: "0007_name_key_nfkc",
  async run(client) {
    await client.query(`ALTER TABLE item DROP CONSTRAINT ${UNIQUE_KEY}`);
    let updated = 0;
    let collisions = 0;
    let currentList: string | undefined;
    let keysInList = new Set<string>();
    for await (const batch of itemsInOrder(client)) {
      const changes: { id: string; key: string }[] = [];
      for (const row of batch) {
        if (row.list_id !== currentList) {
          currentList = row.list_id;
          keysInList = new Set();
        }
        let key = normalizeItemName(row.name);
        if (keysInList.has(key)) {
          collisions += 1;
          key = `${key}#${row.id}`;
        }
        keysInList.add(key);
        if (key !== row.name_key) changes.push({ id: row.id, key });
      }
      await updateKeys(client, changes);
      updated += changes.length;
    }
    await client.query(`ALTER TABLE item ADD CONSTRAINT ${UNIQUE_KEY} UNIQUE (list_id, name_key)`);
    return `${String(updated)} keys updated, ${String(collisions)} collisions`;
  },
};

/** Pozycje partiami po `(list_id, created_at, id)`; czas jako tekst, żeby nie stracić mikrosekund. */
async function* itemsInOrder(client: PoolClient): AsyncGenerator<ItemRow[]> {
  let after: ItemRow | undefined;
  for (;;) {
    const { rows } = await client.query<ItemRow>(
      `SELECT id, list_id, name, name_key, created_at::text AS created_at FROM item
       WHERE $1::uuid IS NULL OR (list_id, created_at, id) > ($1::uuid, $2::timestamptz, $3::uuid)
       ORDER BY list_id, created_at, id LIMIT $4`,
      [after?.list_id ?? null, after?.created_at ?? null, after?.id ?? null, BATCH_SIZE],
    );
    if (rows.length === 0) return;
    yield rows;
    after = rows.at(-1);
  }
}

async function updateKeys(client: PoolClient, changes: { id: string; key: string }[]) {
  if (changes.length === 0) return;
  await client.query(
    `UPDATE item SET name_key = change.key
     FROM unnest($1::uuid[], $2::text[]) AS change(id, key) WHERE item.id = change.id`,
    [changes.map(({ id }) => id), changes.map(({ key }) => key)],
  );
}
