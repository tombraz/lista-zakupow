import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp, TEST_ORIGIN } from "./app";
import { useTestDatabase } from "./database";
import { createUser, signIn } from "./factories";
import { connectLive, liveUrl, upgradeStatus } from "./live";

describe("signing out closes the session's live connections (SEC5, TH-17)", () => {
  const db = useTestDatabase();
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("closes every connection of the signed-out session only and refuses the old cookie", async () => {
    app = buildTestApp(db.pool);
    const user = await createUser(app);
    const phone = await signIn(app, user);
    const url = await liveUrl(app);
    const tabs = [
      await connectLive(url, { cookie: user.cookie }),
      await connectLive(url, { cookie: user.cookie }),
    ];
    const phones = await connectLive(url, { cookie: phone });

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/sign-out",
      headers: { origin: TEST_ORIGIN, cookie: user.cookie },
    });

    expect(response.statusCode).toBe(200);
    for (const tab of tabs) expect(await tab.closed()).toBe(1008);
    expect(await upgradeStatus(url, { cookie: user.cookie })).toBe(401);
    await expect(phones.closed(300)).rejects.toThrow("connection still open");
    phones.close();
  });
});
