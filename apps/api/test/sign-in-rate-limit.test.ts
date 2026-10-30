import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildTestApp, TEST_ORIGIN } from "./app";
import { useTestDatabase } from "./database";
import { createUser, randomIp } from "./factories";
import { captureLogs } from "./logs";

const MINUTE_MS = 60 * 1000;

// MC-04: 10 prób logowania na minutę z jednego IP; 5 nieudanych w 15 minut na jedno konto.
describe("sign-in rate limits (SEC1: TH-09)", () => {
  const db = useTestDatabase();

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-02T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function signIn(
    app: ReturnType<typeof buildTestApp>,
    credentials: { email: string; password: string },
    ip: string,
  ) {
    return app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      headers: { origin: TEST_ORIGIN },
      remoteAddress: ip,
      payload: credentials,
    });
  }

  it("answers 429 rate_limited to the 11th attempt from one IP within a minute", async () => {
    const app = buildTestApp(db.pool);
    const ip = randomIp();
    const statuses: number[] = [];

    for (let attempt = 1; attempt <= 10; attempt += 1) {
      const email = `nikt-${String(attempt)}@example.com`;
      statuses.push((await signIn(app, { email, password: "zle-haslo-1" }, ip)).statusCode);
    }
    const eleventh = await signIn(app, { email: "nikt@example.com", password: "zle-haslo-1" }, ip);

    expect(statuses).toEqual(Array.from({ length: 10 }, () => 401));
    expect(eleventh.statusCode).toBe(429);
    expect(eleventh.json()).toEqual({ error: { code: "rate_limited" } });
    const otherIp = await signIn(app, { email: "nikt@example.com", password: "x" }, randomIp());
    expect(otherIp.statusCode).toBe(401);
    await app.close();
  });

  it("blocks an account after 5 failed attempts from different IPs, even with the right password", async () => {
    const app = buildTestApp(db.pool);
    const user = await createUser(app);

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const failed = await signIn(app, { email: user.email, password: "zle-haslo-1" }, randomIp());
      expect(failed.statusCode).toBe(401);
    }
    const right = await signIn(app, { email: user.email, password: user.password }, randomIp());

    expect(right.statusCode).toBe(429);
    expect(right.json()).toEqual({ error: { code: "rate_limited" } });
    expect(right.headers["set-cookie"]).toBeUndefined();
    await app.close();
  });

  // QA round 1, #1: sprawdzenie i zliczenie muszą być atomowe, inaczej seria równoległych prób
  // przechodzi obok limitu.
  it("checks at most 5 passwords per account when attempts arrive in parallel", async () => {
    const app = buildTestApp(db.pool);
    const user = await createUser(app);

    const responses = await Promise.all(
      Array.from({ length: 30 }, () =>
        signIn(app, { email: user.email, password: "zle-haslo-1" }, randomIp()),
      ),
    );
    const statuses = responses.map((response) => response.statusCode);

    expect(statuses.filter((status) => status === 401)).toHaveLength(5);
    expect(statuses.filter((status) => status === 429)).toHaveLength(25);
    const right = await signIn(app, { email: user.email, password: user.password }, randomIp());
    expect(right.statusCode).toBe(429);
    await app.close();
  });

  it("does not count successful sign-ins toward the account limit", async () => {
    const app = buildTestApp(db.pool);
    const user = await createUser(app);

    for (let attempt = 1; attempt <= 6; attempt += 1) {
      const right = await signIn(app, { email: user.email, password: user.password }, randomIp());
      expect(right.statusCode).toBe(200);
    }
    await app.close();
  });

  it("counts the account limit regardless of e-mail letter case and spaces", async () => {
    const app = buildTestApp(db.pool);
    const user = await createUser(app);

    for (const email of [user.email, user.email.toUpperCase(), ` ${user.email} `]) {
      await signIn(app, { email, password: "zle-haslo-1" }, randomIp());
      await signIn(app, { email, password: "zle-haslo-2" }, randomIp());
    }
    const right = await signIn(app, { email: user.email, password: user.password }, randomIp());

    expect(right.statusCode).toBe(429);
    await app.close();
  });

  it("lets the account sign in again once the 15-minute window has passed", async () => {
    const app = buildTestApp(db.pool);
    const user = await createUser(app);
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await signIn(app, { email: user.email, password: "zle-haslo-1" }, randomIp());
    }

    vi.setSystemTime(Date.now() + 15 * MINUTE_MS + 1000);
    const right = await signIn(app, { email: user.email, password: user.password }, randomIp());

    expect(right.statusCode).toBe(200);
    await app.close();
  });

  it("ignores a client-supplied X-Forwarded-For, so it cannot bypass the IP limit", async () => {
    const app = buildTestApp(db.pool);
    const ip = randomIp();
    let last = 0;

    for (let attempt = 1; attempt <= 11; attempt += 1) {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/sign-in/email",
        headers: { origin: TEST_ORIGIN, "x-forwarded-for": randomIp() },
        remoteAddress: ip,
        payload: { email: `nikt-${String(attempt)}@example.com`, password: "zle-haslo-1" },
      });
      last = response.statusCode;
    }

    expect(last).toBe(429);
    await app.close();
  });

  it("behind one trusted proxy counts the client address the proxy reports", async () => {
    const proxy = randomIp();
    const app = buildTestApp(db.pool, { trustedProxies: proxy });
    const statuses: number[] = [];

    for (let attempt = 1; attempt <= 11; attempt += 1) {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/sign-in/email",
        headers: { origin: TEST_ORIGIN, "x-forwarded-for": randomIp() },
        remoteAddress: proxy,
        payload: { email: `nikt-${String(attempt)}@example.com`, password: "zle-haslo-1" },
      });
      statuses.push(response.statusCode);
    }

    expect(statuses).toEqual(Array.from({ length: 11 }, () => 401));
    await app.close();
  });

  // T-040 (TH-21): powtarzane próby na zablokowane konto nie zalewają logu `security` — jedno
  // zdarzenie na konto i limit w oknie, osobno dla każdego konta.
  it("logs repeated attempts over the account limit once per account", async () => {
    const logs = captureLogs();
    const app = buildTestApp(db.pool, { logger: { level: "info", stream: logs.stream } });
    const accounts = [await createUser(app), await createUser(app)];

    for (const user of accounts) {
      for (let attempt = 1; attempt <= 5 + 10; attempt += 1) {
        await signIn(app, { email: user.email, password: "zle-haslo-1" }, randomIp());
      }
    }

    const limited = logs.security().filter((entry) => entry["event"] === "rate_limited");
    expect(limited).toEqual([
      expect.objectContaining({
        limit: "signInFailuresPerAccount",
        accountKey: expect.any(String) as unknown,
      }),
      expect.objectContaining({
        limit: "signInFailuresPerAccount",
        accountKey: expect.any(String) as unknown,
      }),
    ]);
    expect(limited[0]?.["accountKey"]).not.toEqual(limited[1]?.["accountKey"]);
    await app.close();
  });
});
