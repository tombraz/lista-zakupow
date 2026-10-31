import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { addMember, createList, createUser } from "./factories";
import { captureLogs } from "./logs";
import { connectLive, liveUrl } from "./live";
import { requestsAs } from "./requests";

describe("WS subscribe (SEC1, TH-03)", () => {
  const db = useTestDatabase();
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("confirms a subscription to an own and a shared list", async () => {
    app = buildTestApp(db.pool);
    const ania = await createUser(app);
    const tomek = await createUser(app);
    const list = await createList(db.pool, ania);
    await addMember(db.pool, list, tomek);
    const url = await liveUrl(app);

    for (const user of [ania, tomek]) {
      const client = await connectLive(url, { cookie: user.cookie });
      client.send({ type: "subscribe", listId: list.id });
      expect(await client.next("subscribed")).toEqual({ type: "subscribed", listId: list.id });
      client.close();
    }
  });

  it("answers not_found for someone else's list, logs it and sends none of its changes", async () => {
    const logs = captureLogs();
    app = buildTestApp(db.pool, { logger: { level: "info", stream: logs.stream } });
    const ania = await createUser(app);
    const intruder = await createUser(app);
    const list = await createList(db.pool, ania);
    const url = await liveUrl(app);
    const client = await connectLive(url, { cookie: intruder.cookie });

    client.send({ type: "subscribe", listId: list.id });

    expect(await client.next("error")).toEqual({
      type: "error",
      code: "not_found",
      listId: list.id,
    });
    expect(logs.security()).toContainEqual(
      expect.objectContaining({
        event: "list_access_denied",
        userId: intruder.id,
        listId: list.id,
      }),
    );
    const response = await requestsAs(app, ania)("POST", `/api/v1/lists/${list.id}/items`, {
      name: "Mleko",
    });
    expect(response.statusCode).toBe(201);
    await client.expectSilence();
    expect(client.received().map(({ type }) => type)).toEqual(["error"]);
    client.close();
  });

  it("answers not_found for a list that does not exist or an id that is not a UUID", async () => {
    app = buildTestApp(db.pool);
    const user = await createUser(app);
    const client = await connectLive(await liveUrl(app), { cookie: user.cookie });

    client.send({ type: "subscribe", listId: "0192f0a0-0000-7000-8000-000000000999" });
    expect(await client.next("error")).toMatchObject({ code: "not_found" });
    client.send({ type: "subscribe", listId: "../lists" });
    expect(await client.next("error")).toEqual({
      type: "error",
      code: "not_found",
      listId: "../lists",
    });
    client.close();
  });
});
