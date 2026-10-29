import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { addMember, createItem, createList, createUser } from "./factories";
import { connectLive, liveUrl } from "./live";
import { requestsAs } from "./requests";

describe("no events for changes that did not happen (AC3)", () => {
  const db = useTestDatabase();
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("sends nothing for a duplicate, a missing item, a foreign list, invalid input or a repeated add", async () => {
    app = buildTestApp(db.pool);
    const ania = await createUser(app);
    const tomek = await createUser(app);
    const list = await createList(db.pool, ania);
    await addMember(db.pool, list, tomek);
    await createItem(db.pool, list, ania, "Mleko");
    const anias = await connectLive(await liveUrl(app), { cookie: ania.cookie });
    anias.send({ type: "subscribe", listId: list.id });
    await anias.next("subscribed");
    const as = requestsAs(app, tomek);
    const items = `/api/v1/lists/${list.id}/items`;
    const id = randomUUID();
    expect((await as("POST", items, { id, name: "Chleb" })).statusCode).toBe(201);
    await anias.next("item.upserted");
    await anias.next("lists.changed");

    const statuses = [
      (await as("POST", items, { name: " mleko " })).statusCode,
      (await as("PATCH", `${items}/${randomUUID()}`, { checked: true })).statusCode,
      (await as("DELETE", `${items}/${randomUUID()}`)).statusCode,
      (await as("POST", items, { name: "" })).statusCode,
      (await as("POST", `/api/v1/lists/${randomUUID()}/items`, { name: "Ser" })).statusCode,
      (await as("PATCH", `/api/v1/lists/${list.id}`, { name: "Moja" })).statusCode,
      (await as("POST", items, { id, name: "Chleb" })).statusCode,
    ];

    expect(statuses).toEqual([409, 404, 404, 400, 404, 403, 200]);
    await anias.expectSilence();
    anias.close();
  });
});
