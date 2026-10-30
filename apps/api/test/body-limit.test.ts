import { describe, expect, it } from "vitest";
import { buildTestApp, TEST_ORIGIN } from "./app";
import { useTestDatabase } from "./database";
import { captureLogs } from "./logs";

describe("request body limit (SEC3: TH-13)", () => {
  const db = useTestDatabase();

  it("rejects a body larger than 16 kB with 413", async () => {
    const app = buildTestApp(db.pool);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/lists",
      headers: { "content-type": "application/json", origin: TEST_ORIGIN },
      payload: JSON.stringify({ name: "x".repeat(16 * 1024) }),
    });

    expect(response.statusCode).toBe(413);
    await app.close();
  });

  it("accepts a body just under the limit past the size check", async () => {
    const app = buildTestApp(db.pool);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/lists",
      headers: { "content-type": "application/json", origin: TEST_ORIGIN },
      payload: JSON.stringify({ name: "x".repeat(15 * 1024) }),
    });

    // Treść przeszła limit i dotarła do trasy, która wymaga sesji.
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  // T-034 (TH-13, TH-21): limit treści też zostawia ślad w logu `security`, bez treści żądania.
  it("logs limit_reached when the request body exceeds 16 kB", async () => {
    const logs = captureLogs();
    const app = buildTestApp(db.pool, { logger: { level: "info", stream: logs.stream } });
    const secret = "TAJNA-TRESC-".repeat(16 * 100);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/lists",
      headers: { "content-type": "application/json", origin: TEST_ORIGIN },
      payload: JSON.stringify({ name: secret }),
    });

    expect(response.statusCode).toBe(413);
    const events = logs
      .security()
      .filter((entry) => entry["event"] === "limit_reached" || entry["event"] === "rate_limited");
    expect(events).toEqual([
      expect.objectContaining({
        event: "limit_reached",
        limit: "bodyBytes",
        route: "/api/v1/lists",
      }),
    ]);
    expect(events[0]?.["requestId"]).toEqual(expect.any(String));
    expect(logs.lines.join("\n")).not.toContain("TAJNA-TRESC");
    await app.close();
  });
});
