import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { addMember, createList, createUser } from "./factories";
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
