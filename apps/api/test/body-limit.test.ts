import { describe, expect, it } from "vitest";
import { buildTestApp, TEST_ORIGIN } from "./app";
import { useTestDatabase } from "./database";

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
});
