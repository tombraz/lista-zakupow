import { existsSync } from "node:fs";
import { buildApp } from "./app";
import { readConfig } from "./config";
import { createPool } from "./db/pool";

const config = readConfig(process.env);
const pool = createPool(config.DATABASE_URL);
const app = buildApp({
  pool,
  logger: { level: config.LOG_LEVEL },
  ...(existsSync(config.WEB_DIST_DIR) ? { webDistDir: config.WEB_DIST_DIR } : {}),
});

app.addHook("onClose", async () => {
  await pool.end();
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void app.close();
  });
}

await app.listen({ port: config.PORT, host: config.HOST });
// ci-test T-002: zmiana tylko w apps/api
