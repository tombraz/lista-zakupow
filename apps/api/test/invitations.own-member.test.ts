import { describe, expect, it } from "vitest";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { addMember, createInvitation, createList, createUser } from "./factories";
import { requestsAs } from "./requests";

// AC7 (F-12): właściciel na własnym linku i uczestnik już na liście — nic się nie zmienia.
describe("accepting an invitation to a list you already have", () => {
  const db = useTestDatabase();

  async function setup() {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app);
    const tomek = await createUser(app);
    const list = await createList(db.pool, ania);
    await addMember(db.pool, list, tomek);
    const link = await createInvitation(db.pool, list);
    const accept = (as: { cookie: string }) =>
      requestsAs(app, as)("POST", `/api/v1/invitations/${link.token}/accept`);
    const state = async () => ({
      members: (
        await db.pool.query("SELECT user_id FROM list_member WHERE list_id = $1", [list.id])
      ).rows,
      used: (await db.pool.query("SELECT used_at FROM invitation WHERE id = $1", [link.id])).rows,
    });
    return { app, ania, tomek, list, accept, state };
  }

  it("the owner: 409 own_list with the list id, link stays unused", async () => {
    const { app, ania, tomek, list, accept, state } = await setup();

    const response = await accept(ania);

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: { code: "own_list", listId: list.id } });
    expect(await state()).toEqual({ members: [{ user_id: tomek.id }], used: [{ used_at: null }] });
    await app.close();
  });

  it("a participant: 409 already_member with the list id, link stays unused", async () => {
    const { app, tomek, list, accept, state } = await setup();

    const response = await accept(tomek);

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: { code: "already_member", listId: list.id } });
    expect(await state()).toEqual({ members: [{ user_id: tomek.id }], used: [{ used_at: null }] });
    await app.close();
  });
});
