import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { addMember, createItem, createList, createUser } from "./factories";
import { gatedPool } from "./gated-pool";
import { requestsAs } from "./requests";

// T-119 (TH-04, MC-03): zapis, który sprawdził dostęp przed usunięciem uczestnika, nie może
// się udać po nim. `requireListAccess` (`roleOf`, jedyne zapytanie z CASE WHEN) wstrzymujemy
// po odczycie; usunięcie idzie przez drugą aplikację na niewstrzymanej puli.
describe("item writes after the participant lost access (T-119)", () => {
  const db = useTestDatabase();
  const apps: FastifyInstance[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  async function setUp(matches: RegExp, clients = false) {
    const gate = gatedPool(db.pool, matches, { clients });
    const app = buildTestApp(gate.pool);
    const other = buildTestApp(db.pool);
    apps.push(app, other);
    const ania = await createUser(app);
    const tomek = await createUser(app);
    const list = await createList(db.pool, ania);
    await addMember(db.pool, list, tomek);
    const toBuy = await createItem(db.pool, list, ania, "Mleko");
    const bought = await createItem(db.pool, list, ania, "Chleb");
    await db.pool.query("UPDATE item SET checked_at = now(), checked_by = $1 WHERE id = $2", [
      ania.id,
      bought.id,
    ]);
    return { gate, app, other, ania, tomek, list, toBuy, bought };
  }

  async function snapshot(listId: string) {
    const { rows } = await db.pool.query<Record<string, unknown>>(
      `SELECT i.id, i.name, i.checked_at, i.updated_at, l.updated_at AS list_updated_at
         FROM shopping_list l LEFT JOIN item i ON i.list_id = l.id
        WHERE l.id = $1 ORDER BY i.id`,
      [listId],
    );
    return rows;
  }

  type Setup = Awaited<ReturnType<typeof setUp>>;
  type Request = (s: Setup) => ReturnType<ReturnType<typeof requestsAs>>;
  const add: Request = (s) =>
    requestsAs(s.app, s.tomek)("POST", `/api/v1/lists/${s.list.id}/items`, { name: "Jajka" });
  const removeByOwner: Request = (s) =>
    requestsAs(s.other, s.ania)("DELETE", `/api/v1/lists/${s.list.id}/members/${s.tomek.id}`);
  const writes: [string, Request][] = [
    ["add", add],
    [
      "edit",
      (s) =>
        requestsAs(s.app, s.tomek)("PATCH", `/api/v1/lists/${s.list.id}/items/${s.toBuy.id}`, {
          name: "Masło",
        }),
    ],
    [
      "check",
      (s) =>
        requestsAs(s.app, s.tomek)("PATCH", `/api/v1/lists/${s.list.id}/items/${s.toBuy.id}`, {
          checked: true,
        }),
    ],
    [
      "uncheck",
      (s) =>
        requestsAs(s.app, s.tomek)("PATCH", `/api/v1/lists/${s.list.id}/items/${s.bought.id}`, {
          checked: false,
        }),
    ],
    [
      "delete",
      (s) => requestsAs(s.app, s.tomek)("DELETE", `/api/v1/lists/${s.list.id}/items/${s.toBuy.id}`),
    ],
    [
      "clear checked",
      (s) => requestsAs(s.app, s.tomek)("POST", `/api/v1/lists/${s.list.id}/items/clear-checked`),
    ],
  ];

  const removals: [string, Request][] = [
    ["left", (s) => requestsAs(s.other, s.tomek)("POST", `/api/v1/lists/${s.list.id}/leave`)],
    [
      "deleted their account",
      (s) => requestsAs(s.other, s.tomek)("DELETE", "/api/v1/me", { confirm: true }),
    ],
  ];

  async function writeAcrossRemoval(write: Request, removal: Request) {
    const s = await setUp(/CASE WHEN/);
    const before = await snapshot(s.list.id);
    s.gate.hold();
    const pending = write(s);
    await s.gate.held(1);
    expect((await removal(s)).statusCode).toBe(204);
    s.gate.release();
    const response = await pending;
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: { code: "not_found" } });
    expect(await snapshot(s.list.id)).toEqual(before);
  }

  it.each(writes)(
    "refuses an item write (%s) that started before the participant was removed (AC1)",
    async (_, write) => {
      await writeAcrossRemoval(write, removeByOwner);
    },
  );

  it.each(removals)(
    "refuses an item write that started before the participant %s (AC2)",
    async (_, removal) => {
      await writeAcrossRemoval(add, removal);
    },
  );

  it("makes removing a participant wait for their write already in its transaction", async () => {
    // Zapis wstrzymany w transakcji, po sprawdzeniu członkostwa (blokada wiersza `list_member`).
    const s = await setUp(/FOR SHARE/i, true);
    s.gate.hold();
    const pending = add(s);
    await s.gate.held(1);
    const removal = removeByOwner(s);
    await vi.waitFor(
      async () => {
        const { rows } = await db.pool.query<{ n: number }>(
          "SELECT count(*)::int AS n FROM pg_stat_activity WHERE wait_event_type = 'Lock'",
        );
        expect(rows[0]?.n).toBeGreaterThan(0);
      },
      { timeout: 2000, interval: 20 },
    );
    s.gate.release();
    expect((await pending).statusCode).toBe(201);
    expect((await removal).statusCode).toBe(204);
  });
});
