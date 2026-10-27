import pg from "pg";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app";
import { useTestDatabase } from "./database";

const unreachableDatabase = "postgres://nobody:nothing@127.0.0.1:1/none";

describe("health", () => {
  const db = useTestDatabase();
  let unreachablePool: pg.Pool | undefined;

  function appWithoutDatabase() {
    unreachablePool = new pg.Pool({ connectionString: unreachableDatabase });
    return { app: buildApp({ pool: unreachablePool }), pool: unreachablePool };
  }

  afterEach(async () => {
    await unreachablePool?.end();
    unreachablePool = undefined;
  });

  it("GET /health returns 200 without touching the database", async () => {
    const { app, pool } = appWithoutDatabase();

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ status: "ok" });
    expect(pool.totalCount).toBe(0);
    await app.close();
  });

  it("GET /health/ready returns 200 when the database answers", async () => {
    const app = buildApp({ pool: db.pool });

    const response = await app.inject({ method: "GET", url: "/health/ready" });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ status: "ok", database: "up" });
    await app.close();
  });

  it("GET /health/ready returns 503 and /health stays 200 when the database is unreachable", async () => {
    const { app } = appWithoutDatabase();

    const ready = await app.inject({ method: "GET", url: "/health/ready" });
    const live = await app.inject({ method: "GET", url: "/health" });

    expect(ready.statusCode).toBe(503);
    expect(ready.json()).toEqual({ status: "unavailable", database: "down" });
    expect(live.statusCode).toBe(200);
    await app.close();
  });

  it("keeps running when the database drops idle connections and answers 200 again", async () => {
    const app = buildApp({ pool: db.pool });
    await app.inject({ method: "GET", url: "/health/ready" });
    expect(db.pool.idleCount).toBeGreaterThan(0);

    const admin = new pg.Client({ connectionString: db.pool.options.connectionString });
    await admin.connect();
    await admin.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
       WHERE datname = current_database() AND pid <> pg_backend_pid()`,
    );
    await admin.end();
    await vi.waitFor(() => {
      expect(db.pool.idleCount).toBe(0);
    });

    const response = await app.inject({ method: "GET", url: "/health/ready" });

    expect(response.statusCode).toBe(201);
    await app.close();
  });
});
