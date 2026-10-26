import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { useTestDatabase } from "./database";

describe("request body limit (SEC3: TH-13)", () => {
  const db = useTestDatabase();

  it("rejects a body larger than 16 kB with 413", async () => {
    const app = buildApp({ pool: db.pool });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/lists",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ name: "x".repeat(16 * 1024) }),
    });

    expect(response.statusCode).toBe(413);
    await app.close();
  });

  it("accepts a body just under the limit past the size check", async () => {
    const app = buildApp({ pool: db.pool });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/lists",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ name: "x".repeat(15 * 1024) }),
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });
});
