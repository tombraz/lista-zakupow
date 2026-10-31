import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { createInvitation, createItem, createList, createUser } from "./factories";
import { connectLive, liveUrl, type LiveClient } from "./live";
import { requestsAs } from "./requests";

// T-050 (TH-19, F-10, F-13): uczestnik nie widzi e-maila żadnej osoby — ani w HTTP, ani w WS.
describe("e-mails seen by a participant (TH-19)", () => {
  const db = useTestDatabase();
  let app: FastifyInstance | undefined;
  let live: LiveClient | undefined;

  afterEach(async () => {
    live?.close();
    await app?.close();
  });

  it("never shows e-mails to a participant over HTTP or WS", async () => {
    app = buildTestApp(db.pool);
    const ania = await createUser(app, { name: "Ania" });
    const tomek = await createUser(app, { name: "Tomek" });
    const ola = await createUser(app, { name: "Ola" });
    const list = await createList(db.pool, ania, "Dom");
    await createItem(db.pool, list, ania, "Chleb");
    const link = await createInvitation(db.pool, list);
    const olasLink = await createInvitation(db.pool, list);
    const asTomek = requestsAs(app, tomek);
    const asOla = requestsAs(app, ola);
    const bodies: string[] = [];
    const read = async (response: Promise<{ statusCode: number; body: string }>) => {
      const { statusCode, body } = await response;
      expect(statusCode).toBeLessThan(300);
      bodies.push(body);
    };

    await read(asTomek("GET", `/api/v1/invitations/${link.token}`));
    await read(asTomek("POST", `/api/v1/invitations/${link.token}/accept`));
    live = await connectLive(await liveUrl(app), { cookie: tomek.cookie });
    live.send({ type: "subscribe", listId: list.id });
    await live.next("subscribed");
    await read(asOla("POST", `/api/v1/invitations/${olasLink.token}/accept`));
    await read(requestsAs(app, ania)("POST", `/api/v1/lists/${list.id}/items`, { name: "Mleko" }));
    await read(asTomek("POST", `/api/v1/lists/${list.id}/items`, { name: "Masło" }));
    await live.next("item.upserted");
    await live.next("item.upserted");
    await read(asTomek("GET", "/api/v1/lists"));
    await read(asTomek("GET", `/api/v1/lists/${list.id}`));

    const seen = [...bodies, ...live.received().map((message) => JSON.stringify(message))];
    expect(seen.join("\n")).toContain("Ania");
    for (const person of [ania, tomek, ola]) {
      for (const text of seen) expect(text).not.toContain(person.email);
    }
  });
});
