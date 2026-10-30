import { LIVE_LIMITS, RATE_LIMITS } from "@lista/shared";
import { describe, expect, it } from "vitest";
import { buildTestApp } from "./app";
import { testClock } from "./clock";
import { useTestDatabase } from "./database";
import { randomIp } from "./factories";
import { captureLogs } from "./logs";

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

  // T-027 (TH-21): przekroczenie limitu zostawia ślad w logu `security`, bez adresu IP.
  it("logs rate_limited on /health/ready", async () => {
    const logs = captureLogs();
    const app = buildTestApp(db.pool, { logger: { level: "info", stream: logs.stream } });
    const ip = randomIp();

    for (let request = 1; request <= 31; request += 1) {
      await app.inject({ method: "GET", url: "/health/ready", remoteAddress: ip });
    }

    const limited = logs.security().filter((entry) => entry["event"] === "rate_limited");
    expect(limited).toHaveLength(1);
    expect(limited[0]).toMatchObject({ route: "/health/ready" });
    expect(limited[0]?.["requestId"]).toEqual(expect.any(String));
    expect(JSON.stringify(limited)).not.toContain(ip);
    await app.close();
  });

  // T-040 (TH-21): 429 ponad limit nie zalewają logu `security` — jedno zdarzenie na IP i limit
  // w oknie, osobno dla każdego IP (deduplikacja nie ukrywa drugiego atakującego).
  it("logs repeated 429s once per IP and window, separately for each IP", async () => {
    const start = "2026-10-30T10:00:00Z";
    const clock = testClock(start);
    const logs = captureLogs();
    const app = buildTestApp(db.pool, { logger: { level: "info", stream: logs.stream }, clock });
    const first = randomIp();
    const second = randomIp();
    const flood = async (ip: string, times: number) => {
      for (let request = 1; request <= times; request += 1) {
        await app.inject({ method: "GET", url: "/health/ready", remoteAddress: ip });
      }
    };
    const limited = () => logs.security().filter((entry) => entry["event"] === "rate_limited");

    await flood(first, RATE_LIMITS.healthReadyPerIp.max + 10);
    await flood(second, RATE_LIMITS.healthReadyPerIp.max + 10);
    expect(limited()).toHaveLength(2);

    const later = Date.parse(start) + LIVE_LIMITS.limitLogWindowSeconds * 1000;
    clock.set(new Date(later).toISOString());
    const over = await app.inject({ method: "GET", url: "/health/ready", remoteAddress: first });

    expect(over.statusCode).toBe(429);
    const event = { event: "rate_limited", route: "/health/ready", limit: "healthReadyPerIp" };
    expect(limited()).toEqual([
      expect.objectContaining(event),
      expect.objectContaining(event),
      expect.objectContaining(event),
    ]);
    expect(JSON.stringify(limited())).not.toContain(first);
    expect(JSON.stringify(limited())).not.toContain(second);
    await app.close();
  });
});
