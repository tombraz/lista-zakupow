import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createLiveHub } from "../src/modules/na-zywo";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { addMember, createList, createUser } from "./factories";
import { gatedPool } from "./gated-pool";
import { connectLive, liveUrl } from "./live";
import { requestsAs } from "./requests";

describe("deleting a list revokes live access (SEC2, TH-04, MC-03)", () => {
  const db = useTestDatabase();
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("sends list.deleted then access.revoked, drops the subscription and refuses a new one", async () => {
    app = buildTestApp(db.pool);
    const ania = await createUser(app);
    const tomek = await createUser(app);
    const list = await createList(db.pool, ania);
    const other = await createList(db.pool, ania);
    await addMember(db.pool, list, tomek);
    await addMember(db.pool, other, tomek);
    const tomeks = await connectLive(await liveUrl(app), { cookie: tomek.cookie });
    for (const listId of [list.id, other.id]) {
      tomeks.send({ type: "subscribe", listId });
      await tomeks.next("subscribed");
    }

    expect((await requestsAs(app, ania)("DELETE", `/api/v1/lists/${list.id}`)).statusCode).toBe(
      204,
    );

    await tomeks.next("list.deleted");
    await tomeks.next("access.revoked");
    await tomeks.next("lists.changed");
    const types = tomeks.received().map(({ type }) => type);
    expect(types.slice(-3)).toEqual(["list.deleted", "access.revoked", "lists.changed"]);
    expect(tomeks.received()).toContainEqual({ type: "access.revoked", listId: list.id });

    tomeks.send({ type: "subscribe", listId: list.id });
    expect(await tomeks.next("error")).toEqual({
      type: "error",
      code: "not_found",
      listId: list.id,
    });
    const write = await requestsAs(app, tomek)("POST", `/api/v1/lists/${list.id}/items`, {
      name: "Mleko",
    });
    expect(write.statusCode).toBe(404);
    await tomeks.expectSilence();

    // Subskrypcja innej listy zostaje.
    await requestsAs(app, ania)("POST", `/api/v1/lists/${other.id}/items`, { name: "Chleb" });
    expect((await tomeks.next("item.upserted")).listId).toBe(other.id);
    tomeks.close();
  });
});

// Usunięcie uczestnika (T-058) to zapis w bazie i `revoke`; tu oba wprost, bo trasy jeszcze nie ma.
describe("removing a participant revokes live access (T-056, TH-04, MC-03)", () => {
  const db = useTestDatabase();
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  async function removeMember(listId: string, userId: string) {
    await db.pool.query("DELETE FROM list_member WHERE list_id = $1 AND user_id = $2", [
      listId,
      userId,
    ]);
  }

  it("leaves no subscription when access is revoked while the subscribe check is running (AC1)", async () => {
    // Sprawdzenie dostępu (`roleOf`) czyta członkostwo; jego wynik wstrzymujemy po odczycie.
    const access = gatedPool(db.pool, /"list_member"/);
    const live = createLiveHub();
    app = buildTestApp(access.pool, { live });
    const ania = await createUser(app);
    const tomek = await createUser(app);
    const list = await createList(db.pool, ania);
    await addMember(db.pool, list, tomek);
    const tomeks = await connectLive(await liveUrl(app), { cookie: tomek.cookie });

    access.hold();
    tomeks.send({ type: "subscribe", listId: list.id });
    await access.held(1);
    await removeMember(list.id, tomek.id);
    live.revoke(tomek.id, list.id);
    access.release();

    expect(await tomeks.next("error")).toEqual({
      type: "error",
      code: "not_found",
      listId: list.id,
    });
    await requestsAs(app, ania)("POST", `/api/v1/lists/${list.id}/items`, { name: "Mleko" });
    await tomeks.expectSilence();
    expect(tomeks.received().map(({ type }) => type)).not.toContain("subscribed");
    tomeks.close();
  });
  it("stops list events to a removed participant and refuses their writes (SEC1, TH-04)", async () => {
    const live = createLiveHub();
    app = buildTestApp(db.pool, { live });
    const ania = await createUser(app);
    const tomek = await createUser(app);
    const list = await createList(db.pool, ania);
    await addMember(db.pool, list, tomek);
    const tomeks = await connectLive(await liveUrl(app), { cookie: tomek.cookie });
    tomeks.send({ type: "subscribe", listId: list.id });
    await tomeks.next("subscribed");

    await removeMember(list.id, tomek.id);
    live.revoke(tomek.id, list.id);

    expect(await tomeks.next("access.revoked")).toEqual({
      type: "access.revoked",
      listId: list.id,
    });
    await requestsAs(app, ania)("POST", `/api/v1/lists/${list.id}/items`, { name: "Mleko" });
    const write = await requestsAs(app, tomek)("POST", `/api/v1/lists/${list.id}/items`, {
      name: "Chleb",
    });
    expect(write.statusCode).toBe(404);
    await tomeks.expectSilence();
    expect(tomeks.received().map(({ type }) => type)).not.toContain("item.upserted");
    tomeks.close();
  });
});
