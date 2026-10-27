import { describe, expect, it } from "vitest";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { randomIp } from "./factories";

// SEC8 (CodeQL js/missing-rate-limiting): /health/ready odpytuje bazę — 30 na minutę z jednego IP.
describe("health rate limits (SEC8)", () => {
  const db = useTestDatabase();

  it("answers 429 rate_limited to the 31st GET /health/ready from one IP within a minute", async () => {
    const app = buildTestApp(db.pool);
    const ip = randomIp();
    const statuses: number[] = [];

    for (let request = 1; request <= 30; request += 1) {
      statuses.push(
        (await app.inject({ method: "GET", url: "/health/ready", remoteAddress: ip })).statusCode,
      );
    }
    const over = await app.inject({ method: "GET", url: "/health/ready", remoteAddress: ip });

    expect(statuses).toEqual(Array.from({ length: 30 }, () => 200));
    expect(over.statusCode).toBe(429);
    expect(over.json()).toEqual({ error: { code: "rate_limited" } });
    const otherIp = await app.inject({
      method: "GET",
      url: "/health/ready",
      remoteAddress: randomIp(),
    });
    expect(otherIp.statusCode).toBe(200);
    await app.close();
  });

  it("does not limit GET /health (Fly healthcheck, no database)", async () => {
    const app = buildTestApp(db.pool);
    const ip = randomIp();
    const statuses: number[] = [];

    for (let request = 1; request <= 40; request += 1) {
      statuses.push(
        (await app.inject({ method: "GET", url: "/health", remoteAddress: ip })).statusCode,
      );
    }

    expect(statuses).toEqual(Array.from({ length: 40 }, () => 200));
    await app.close();
  });
});
