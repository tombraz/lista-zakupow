import { existsSync } from "node:fs";
import { buildApp } from "./app";
import { readConfig } from "./config";
import { createPool } from "./db/pool";

const config = readConfig(process.env);
const pool = createPool(config.DATABASE_URL);
const app = buildApp({
  pool,
  auth: { secret: config.BETTER_AUTH_SECRET, origin: config.APP_ORIGIN },
  logger: { level: config.LOG_LEVEL },
  ...(config.TRUSTED_PROXIES ? { trustedProxies: config.TRUSTED_PROXIES } : {}),
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
