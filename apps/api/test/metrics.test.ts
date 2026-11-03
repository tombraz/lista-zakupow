import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { Pool, QueryResult } from "pg";
import { describe, expect, it } from "vitest";
import { addMember, createList, type TestList } from "./factories";
import { useTestDatabase } from "./database";

// T-065: plik `apps/api/scripts/metrics.sql` wykonany tak, jak w psql — cały, jednym
// zapytaniem, w transakcji tylko do odczytu (każdy zapis albo DDL skończyłby się błędem).
const METRICS_FILE = new URL("../scripts/metrics.sql", import.meta.url);
type Rows = Record<string, unknown>;

// `pg` zamienia `date` na `Date` o północy w strefie procesu; z powrotem `RRRR-MM-DD`, jak w psql.
function dayText(value: unknown): unknown {
  if (!(value instanceof Date)) return value;
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${String(value.getFullYear())}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function withDaysAsText(result: QueryResult<Rows>): QueryResult<Rows> {
  const rows = result.rows.map((row) =>
    Object.fromEntries(Object.entries(row).map(([key, value]) => [key, dayText(value)])),
  );
  return { ...result, rows };
}

async function runMetrics(pool: Pool): Promise<QueryResult<Rows>[]> {
  const sql = await readFile(METRICS_FILE, "utf8");
  const client = await pool.connect();
  try {
    await client.query("BEGIN READ ONLY");
    // Kilka instrukcji w jednym zapytaniu: `pg` zwraca tablicę wyników (typy tego nie opisują).
    const results: unknown = await client.query<Rows>(sql);
    await client.query("ROLLBACK");
    const list = Array.isArray(results)
      ? (results as QueryResult<Rows>[])
      : [results as QueryResult<Rows>];
    return list.map(withDaysAsText);
  } finally {
    client.release();
  }
}

async function insertUser(pool: Pool): Promise<{ id: string }> {
  const id = randomUUID();
  await pool.query(`INSERT INTO "user" (id, name, email) VALUES ($1, 'Domownik', $2)`, [
    id,
    `user-${id}@example.com`,
  ]);
  return { id };
}

async function activity(
  pool: Pool,
  list: Pick<TestList, "id">,
  user: { id: string },
  day: string,
  checks: number,
): Promise<void> {
  await pool.query(
    "INSERT INTO list_daily_activity (list_id, day, user_id, checks) VALUES ($1, $2, $3, $4)",
    [list.id, day, user.id, checks],
  );
}

async function sharedList(
  pool: Pool,
): Promise<{ list: TestList; owner: { id: string }; member: { id: string } }> {
  const owner = await insertUser(pool);
  const member = await insertUser(pool);
  const list = await createList(pool, owner);
  await addMember(pool, list, member);
  return { list, owner, member };
}

describe("metrics.sql", () => {
  const db = useTestDatabase();

  it("counts distinct active users per Monday-Sunday week, only on shared lists (AC1)", async () => {
    const { list, owner, member } = await sharedList(db.pool);
    const loner = await insertUser(db.pool);
    const privateList = await createList(db.pool, loner);

    // Tydzień od pon. 2026-10-26: niedziela 2026-11-01 należy jeszcze do niego.
    await activity(db.pool, list, owner, "2026-10-26", 1);
    await activity(db.pool, list, owner, "2026-11-01", 2);
    await activity(db.pool, list, member, "2026-11-01", 1);
    // Poniedziałek 2026-11-02 zaczyna nowy tydzień.
    await activity(db.pool, list, member, "2026-11-02", 1);
    // Lista prywatna (bez uczestników) nie liczy się.
    await activity(db.pool, privateList, loner, "2026-10-27", 5);
    await activity(db.pool, privateList, loner, "2026-11-03", 5);
    // Przełom roku: czw. 2026-12-31 i pt. 2027-01-01 to ten sam tydzień od pon. 2026-12-28.
    await activity(db.pool, list, owner, "2026-12-31", 1);
    await activity(db.pool, list, member, "2027-01-01", 1);

    const [active] = await runMetrics(db.pool);

    expect(active?.rows).toEqual([
      { tydzień: "2026-10-26", aktywni_domownicy: 2 },
      { tydzień: "2026-11-02", aktywni_domownicy: 1 },
      { tydzień: "2026-12-28", aktywni_domownicy: 2 },
    ]);
  });
  it("counts days per week with at least 3 checks on one shared list (AC2)", async () => {
    const first = await sharedList(db.pool);
    const second = await sharedList(db.pool);
    const loner = await insertUser(db.pool);
    const privateList = await createList(db.pool, loner);

    // pon. 2026-10-26: 2 + 1 = 3 odhaczenia dwóch osób na jednej liście — dzień się liczy.
    await activity(db.pool, first.list, first.owner, "2026-10-26", 2);
    await activity(db.pool, first.list, first.member, "2026-10-26", 1);
    // wt. 2026-10-27: tylko 2 — granica, nie liczy się.
    await activity(db.pool, first.list, first.owner, "2026-10-27", 2);
    // śr. 2026-10-28: 2 + 2 na dwóch różnych listach — żadna nie ma 3, nie liczy się.
    await activity(db.pool, first.list, first.owner, "2026-10-28", 2);
    await activity(db.pool, second.list, second.owner, "2026-10-28", 2);
    // czw. 2026-10-29: obie listy po 3 — to nadal jeden dzień.
    await activity(db.pool, first.list, first.owner, "2026-10-29", 3);
    await activity(db.pool, second.list, second.member, "2026-10-29", 3);
    // pt. 2026-10-30: lista prywatna z 9 odhaczeniami nie liczy się.
    await activity(db.pool, privateList, loner, "2026-10-30", 9);
    // pon. 2026-11-02: nowy tydzień.
    await activity(db.pool, second.list, second.owner, "2026-11-02", 4);
    // pon. 2026-11-09: tydzień z aktywnością, ale bez dnia ≥ 3 — dla tego tygodnia 0 dni.
    await activity(db.pool, first.list, first.owner, "2026-11-09", 1);

    const [, days] = await runMetrics(db.pool);

    expect(days?.rows).toEqual([
      { tydzień: "2026-10-26", dni_wspólnych_zakupów: 2 },
      { tydzień: "2026-11-02", dni_wspólnych_zakupów: 1 },
      { tydzień: "2026-11-09", dni_wspólnych_zakupów: 0 },
    ]);
  });
  it("returns only week and counts, and the file only reads (AC3)", async () => {
    const { list, owner } = await sharedList(db.pool);
    await activity(db.pool, list, owner, "2026-11-02", 3);
    const sql = await readFile(METRICS_FILE, "utf8");

    // `runMetrics` działa w `BEGIN READ ONLY`: INSERT/UPDATE/DELETE/DDL zakończyłyby się błędem.
    const results = await runMetrics(db.pool);

    expect(results.map((result) => result.fields.map((field) => field.name))).toEqual([
      ["tydzień", "aktywni_domownicy"],
      ["tydzień", "dni_wspólnych_zakupów"],
    ]);
    expect(results.map((result) => result.rows)).toEqual([
      [{ tydzień: "2026-11-02", aktywni_domownicy: 1 }],
      [{ tydzień: "2026-11-02", dni_wspólnych_zakupów: 1 }],
    ]);
    // Bez metakomend psql (plik działa też w Neon SQL Editor) i bez sterowania transakcją,
    // które mogłoby wyjść z trybu tylko do odczytu.
    expect(sql).not.toMatch(/^\s*\\/m);
    expect(sql).not.toMatch(/\b(BEGIN|COMMIT|ROLLBACK|END|SET)\b/i);
  });
});
