import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { createList, createUser } from "./factories";
import { gatedPool } from "./gated-pool";
import { connectLive, liveUrl } from "./live";

// T-070 (TH-20): wiadomość WS z NUL w `listId` odrzuca schemat, zanim cokolwiek pójdzie do bazy.
describe("WS message with NUL in listId (T-070, AC7)", () => {
  const db = useTestDatabase();
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("answers validation_failed without a database query and keeps the connection usable", async () => {
    const watched = gatedPool(db.pool, /./);
    app = buildTestApp(watched.pool);
    const ania = await createUser(app);
    const list = await createList(db.pool, ania);
    const client = await connectLive(await liveUrl(app), { cookie: ania.cookie });

    const nulIds = ["\u0000", `\u0000${list.id}`, `${list.id}\u0000`, "%00"];
    for (const type of ["subscribe", "unsubscribe"]) {
      for (const listId of nulIds.slice(0, 3)) {
        const before = watched.queries();
        client.send({ type, listId });
        expect(await client.next("error")).toEqual({ type: "error", code: "validation_failed" });
        expect({ type, listId, queries: watched.queries() - before }).toEqual({
          type,
          listId,
          queries: 0,
        });
      }
    }
    // `%00` to zwykły tekst w JSON, nie NUL: nieznana lista, jak w HTTP.
    client.send({ type: "subscribe", listId: "%00" });
    expect(await client.next("error")).toEqual({ type: "error", code: "not_found", listId: "%00" });

    client.send({ type: "subscribe", listId: list.id });
    expect(await client.next("subscribed")).toEqual({ type: "subscribed", listId: list.id });
    client.close();
  });
});
