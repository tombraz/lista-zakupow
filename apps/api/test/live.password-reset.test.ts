import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { TEST_ORIGIN } from "./app";
import { useTestDatabase } from "./database";
import { addMember, createList, createUser, randomIp, signIn } from "./factories";
import { connectLive, liveUrl, upgradeStatus } from "./live";
import { requestsAs } from "./requests";
import { resetTokenFor } from "./reset-token";

// SEC2 (TH-28): reset hasła kończy sesje konta razem z ich połączeniami na żywo.
describe("a password reset closes the account's live connections (SEC2, TH-28)", () => {
  const db = useTestDatabase();
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("closes every socket of the account's sessions, stops list events and refuses reconnecting", async () => {
    const test = await resetTokenFor(db.pool);
    app = test.app;
    const owner = await createUser(app);
    const list = await createList(db.pool, owner);
    await addMember(db.pool, list, test.user);
    const phone = await signIn(app, test.user);
    const url = await liveUrl(app);
    const sockets = [
      await connectLive(url, { cookie: test.user.cookie }),
      await connectLive(url, { cookie: phone }),
    ];
    for (const socket of sockets) {
      socket.send({ type: "subscribe", listId: list.id });
      await socket.next("subscribed");
    }
    const owners = await connectLive(url, { cookie: owner.cookie });

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/reset-password",
      headers: { origin: TEST_ORIGIN },
      remoteAddress: randomIp(),
      payload: { token: test.token, newPassword: "nowe haslo 123" },
    });

    expect(response.statusCode).toBe(200);
    for (const socket of sockets) expect(await socket.closed()).toBe(1008);
    const added = await requestsAs(app, owner)("POST", `/api/v1/lists/${list.id}/items`, {
      name: "Mleko",
    });
    expect(added.statusCode).toBe(201);
    for (const socket of sockets) {
      expect(socket.received().some((message) => message.type === "item.upserted")).toBe(false);
    }
    for (const cookie of [test.user.cookie, phone]) {
      expect(await upgradeStatus(url, { cookie })).toBe(401);
    }
    await expect(owners.closed(300)).rejects.toThrow("connection still open");
    owners.close();
  });
});
