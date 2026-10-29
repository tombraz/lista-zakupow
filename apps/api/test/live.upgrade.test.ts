import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { createUser } from "./factories";
import { captureLogs } from "./logs";
import { liveUrl, upgradeStatus } from "./live";

describe("GET /api/v1/live upgrade (SEC3 TH-14, SEC4 TH-16)", () => {
  const db = useTestDatabase();
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("opens a WebSocket for a session cookie from the app origin", async () => {
    app = buildTestApp(db.pool);
    const user = await createUser(app);
    const url = await liveUrl(app);

    expect(await upgradeStatus(url, { cookie: user.cookie })).toBe(101);
  });

  it("rejects an upgrade without a session with 401", async () => {
    app = buildTestApp(db.pool);
    const url = await liveUrl(app);

    expect(await upgradeStatus(url)).toBe(401);
  });

  it("rejects a valid session cookie from a foreign or missing Origin (CSWSH)", async () => {
    app = buildTestApp(db.pool);
    const user = await createUser(app);
    const url = await liveUrl(app);

    expect(await upgradeStatus(url, { cookie: user.cookie, origin: "https://evil.example" })).toBe(
      403,
    );
    expect(await upgradeStatus(url, { cookie: user.cookie, origin: null })).toBe(403);
  });

  it("ignores a session token in the query string and keeps it out of the logs", async () => {
    const logs = captureLogs();
    app = buildTestApp(db.pool, { logger: { level: "info", stream: logs.stream } });
    const user = await createUser(app);
    const token = decodeURIComponent(user.cookie.split("=")[1] ?? "");
    const url = await liveUrl(app);

    expect(await upgradeStatus(url, { query: `?token=${encodeURIComponent(token)}` })).toBe(401);
    expect(await upgradeStatus(url, { query: `?session_token=${user.cookie}` })).toBe(401);
    const session = token.split(".")[0] ?? token;
    expect(session.length).toBeGreaterThan(10);
    expect(logs.lines.join("\n")).not.toContain(session);
  });
});
