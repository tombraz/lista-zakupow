import { randomUUID } from "node:crypto";
import net from "node:net";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { migrateDatabase } from "../src/db/migrate";
import { createPool } from "../src/db/pool";
import { databaseUrl } from "./database-constants";

// Uśpiona baza Neon odpowiada dopiero po wybudzeniu; release_command na staging padł na
// „Connection terminated due to connection timeout” (T-010, przebieg 40877860081).
const WAKE_UP_DELAY_MS = 4_000;

/** Proxy TCP, które łączy z Postgresem dopiero po `delayMs` (jak budząca się baza). */
async function startSlowProxy(targetUrl: string, delayMs: number) {
  const target = new URL(targetUrl);
  const sockets = new Set<net.Socket>();
  const server = net.createServer((client) => {
    sockets.add(client);
    client.pause();
    setTimeout(() => {
      const upstream = net.connect(Number(target.port), target.hostname, () => {
        client.pipe(upstream).pipe(client);
        client.resume();
      });
      sockets.add(upstream);
      upstream.on("error", () => client.destroy());
      client.on("error", () => upstream.destroy());
      client.on("close", () => upstream.destroy());
    }, delayMs);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as net.AddressInfo;
  const url = new URL(targetUrl);
  url.hostname = "127.0.0.1";
  url.port = String(port);
  return {
    url: url.toString(),
    close: () =>
      new Promise<void>((resolve) => {
        for (const socket of sockets) socket.destroy();
        server.close(() => {
          resolve();
        });
      }),
  };
}

describe("migrations against a database that is waking up", () => {
  const adminUrl = inject("postgresAdminUrl");
  const name = `test_${randomUUID().replaceAll("-", "")}`;
  let proxy: Awaited<ReturnType<typeof startSlowProxy>>;

  beforeAll(async () => {
    const admin = createPool(adminUrl);
    await admin.query(`CREATE DATABASE ${name}`);
    await admin.end();
    proxy = await startSlowProxy(databaseUrl(adminUrl, name), WAKE_UP_DELAY_MS);
  });

  afterAll(async () => {
    await proxy.close();
    const admin = createPool(adminUrl);
    await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await admin.end();
  });

  it("waits for the database instead of failing the deployment", { timeout: 30_000 }, async () => {
    await migrateDatabase(proxy.url);

    const check = createPool(databaseUrl(adminUrl, name));
    const { rows } = await check.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations",
    );
    await check.end();
    expect(rows[0]?.count).toBeGreaterThan(0);
  });
});
