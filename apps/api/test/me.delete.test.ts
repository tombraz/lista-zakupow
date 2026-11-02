import type { Item } from "@lista/shared";
import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { addMember, createInvitation, createList, createUser, signIn } from "./factories";
import { capturingMailer } from "./mailer";
import { requestResetToken } from "./reset-token";
import { requestsAs } from "./requests";

/** Liczba wierszy tabeli spełniających warunek (stan bazy przed i po, AC1). */
async function count(pool: Pool, table: string, where: string, value: string): Promise<number> {
  const { rows } = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM "${table}" WHERE ${where}`,
    [value],
  );
  return rows[0]?.n ?? 0;
}

/** Wiersze domownika we wszystkich tabelach, które usunięcie konta ma wyczyścić (data-model.md). */
async function rowsOf(pool: Pool, userId: string) {
  return {
    user: await count(pool, "user", "id = $1", userId),
    session: await count(pool, "session", "user_id = $1", userId),
    account: await count(pool, "account", "user_id = $1", userId),
    ownedLists: await count(pool, "shopping_list", "owner_id = $1", userId),
    memberships: await count(pool, "list_member", "user_id = $1", userId),
    activity: await count(pool, "list_daily_activity", "user_id = $1", userId),
    resetTokens: await count(pool, "verification", "value = $1", userId),
  };
}

async function rowsOfList(pool: Pool, listId: string) {
  return {
    list: await count(pool, "shopping_list", "id = $1", listId),
    items: await count(pool, "item", "list_id = $1", listId),
    members: await count(pool, "list_member", "list_id = $1", listId),
    invitations: await count(pool, "invitation", "list_id = $1", listId),
  };
}

// T-062 AC1 (F-04, TH-18): usunięcie konta wg data-model.md w jednej transakcji.
describe("DELETE /api/v1/me", () => {
  const db = useTestDatabase();

  it("answers 204 and removes the account, its lists, memberships, sessions and activity, keeping its items on others' lists unsigned", async () => {
    const { mailer, sent } = capturingMailer();
    const app = buildTestApp(db.pool, { mailer });
    const ania = await createUser(app, { name: "Ania" });
    const tomek = await createUser(app, { name: "Tomek" });
    const ola = await createUser(app, { name: "Ola" });
    await signIn(app, ania);
    const home = await createList(db.pool, ania, "Dom");
    const garage = await createList(db.pool, ania, "Garaż");
    for (const list of [home, garage]) {
      await addMember(db.pool, list, tomek);
      await createInvitation(db.pool, list);
    }
    const asAnia = requestsAs(app, ania);
    for (const list of [home, garage]) {
      const added = await asAnia("POST", `/api/v1/lists/${list.id}/items`, { name: "Chleb" });
      expect(added.statusCode).toBe(201);
    }
    const plot = await createList(db.pool, ola, "Działka");
    await addMember(db.pool, plot, ania);
    const coal = await asAnia("POST", `/api/v1/lists/${plot.id}/items`, { name: "Węgiel" });
    const coalId = coal.json<Item>().id;
    const checked = await asAnia("PATCH", `/api/v1/lists/${plot.id}/items/${coalId}`, {
      checked: true,
    });
    expect([coal.statusCode, checked.statusCode]).toEqual([201, 200]);
    await requestResetToken(app, ania, sent);
    expect(await rowsOf(db.pool, ania.id)).toEqual({
      user: 1,
      session: 2,
      account: 1,
      ownedLists: 2,
      memberships: 1,
      activity: 1,
      resetTokens: 1,
    });

    const response = await asAnia("DELETE", "/api/v1/me", { confirm: true });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe("");
    expect(await rowsOf(db.pool, ania.id)).toEqual({
      user: 0,
      session: 0,
      account: 0,
      ownedLists: 0,
      memberships: 0,
      activity: 0,
      resetTokens: 0,
    });
    for (const list of [home, garage]) {
      expect(await rowsOfList(db.pool, list.id)).toEqual({
        list: 0,
        items: 0,
        members: 0,
        invitations: 0,
      });
    }
    const asOla = requestsAs(app, ola);
    const details = await asOla("GET", `/api/v1/lists/${plot.id}`);
    expect(details.json<{ members: unknown[]; items: Item[] }>()).toMatchObject({
      members: [],
      items: [{ id: coalId, name: "Węgiel", addedBy: null, checked: true, checkedBy: null }],
    });
    await app.close();
  });
});
