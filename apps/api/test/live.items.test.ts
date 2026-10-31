import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Item } from "@lista/shared";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { addMember, createList, createUser, type TestUser } from "./factories";
import { connectLive, liveUrl, type LiveClient } from "./live";
import { requestsAs } from "./requests";

describe("item events on the list channel (AC1, F-14)", () => {
  const db = useTestDatabase();
  let app: FastifyInstance | undefined;
  const clients: LiveClient[] = [];

  afterEach(async () => {
    for (const client of clients.splice(0)) client.close();
    await app?.close();
    app = undefined;
  });

  async function shoppingTogether() {
    app = buildTestApp(db.pool);
    const ania = await createUser(app, { name: "Ania" });
    const tomek = await createUser(app, { name: "Tomek" });
    const list = await createList(db.pool, ania);
    await addMember(db.pool, list, tomek);
    const url = await liveUrl(app);
    const subscribe = async (user: TestUser) => {
      const client = await connectLive(url, { cookie: user.cookie });
      clients.push(client);
      client.send({ type: "subscribe", listId: list.id });
      await client.next("subscribed");
      return client;
    };
    return {
      list,
      anias: await subscribe(ania),
      tomeks: await subscribe(tomek),
      tomek: requestsAs(app, tomek),
    };
  }

  it("sends item.upserted with the API Item when someone adds, edits or checks an item", async () => {
    const { list, anias, tomek } = await shoppingTogether();

    const added = await tomek("POST", `/api/v1/lists/${list.id}/items`, { name: "Mleko" });
    expect(added.statusCode).toBe(201);
    expect(await anias.next("item.upserted")).toEqual({
      type: "item.upserted",
      listId: list.id,
      item: added.json<Item>(),
    });

    const itemId = added.json<Item>().id;
    const edited = await tomek("PATCH", `/api/v1/lists/${list.id}/items/${itemId}`, {
      note: "2 l",
    });
    expect(await anias.next("item.upserted")).toEqual({
      type: "item.upserted",
      listId: list.id,
      item: edited.json<Item>(),
    });

    const checked = await tomek("PATCH", `/api/v1/lists/${list.id}/items/${itemId}`, {
      checked: true,
    });
    const event = await anias.next("item.upserted");
    expect(event.item).toEqual(checked.json<Item>());
    expect(event.item.checkedBy?.name).toBe("Tomek");
  });

  it("sends the event to the author too, and lists.changed to everyone with access", async () => {
    const { list, anias, tomeks, tomek } = await shoppingTogether();

    await tomek("POST", `/api/v1/lists/${list.id}/items`, { name: "Chleb" });

    expect((await tomeks.next("item.upserted")).item.name).toBe("Chleb");
    expect(await anias.next("lists.changed")).toEqual({ type: "lists.changed" });
    expect(await tomeks.next("lists.changed")).toEqual({ type: "lists.changed" });
  });

  it("sends item.deleted and items.cleared", async () => {
    const { list, anias, tomek } = await shoppingTogether();
    const add = async (name: string) =>
      (await tomek("POST", `/api/v1/lists/${list.id}/items`, { name })).json<Item>().id;
    const milk = await add("Mleko");
    const bread = await add("Chleb");
    const eggs = await add("Jajka");

    await tomek("DELETE", `/api/v1/lists/${list.id}/items/${milk}`);
    expect(await anias.next("item.deleted")).toEqual({
      type: "item.deleted",
      listId: list.id,
      itemId: milk,
    });

    await tomek("PATCH", `/api/v1/lists/${list.id}/items/${bread}`, { checked: true });
    await tomek("PATCH", `/api/v1/lists/${list.id}/items/${eggs}`, { checked: true });
    const cleared = await tomek("POST", `/api/v1/lists/${list.id}/items/clear-checked`);
    const event = await anias.next("items.cleared");
    expect(event.listId).toBe(list.id);
    expect(event.itemIds.toSorted()).toEqual([bread, eggs].toSorted());
    expect(cleared.json<{ deletedIds: string[] }>().deletedIds.toSorted()).toEqual(
      event.itemIds.toSorted(),
    );
  });

  it("delivers the change in well under a second (N-06: ≤ 5 s)", async () => {
    const { list, anias, tomek } = await shoppingTogether();

    const start = performance.now();
    await tomek("POST", `/api/v1/lists/${list.id}/items`, { name: "Masło" });
    await anias.next("item.upserted", 1000);

    expect(performance.now() - start).toBeLessThan(1000);
  });
});
