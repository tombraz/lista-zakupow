import { existsSync } from "node:fs";
import { buildApp } from "./app";
import { scheduleCleanup } from "./cleanup";
import { systemClock } from "./clock";
import { readConfig } from "./config";
import { createPool } from "./db/pool";
import { BrevoMailer, MailpitMailer } from "./modules/konta";

const config = readConfig(process.env);
const pool = createPool(config.DATABASE_URL);
const app = buildApp({
  pool,
  auth: { secret: config.BETTER_AUTH_SECRET, origin: config.APP_ORIGIN },
  mailer:
    config.mail.provider === "brevo"
      ? new BrevoMailer({ apiKey: config.mail.apiKey, sender: config.mail.sender })
      : new MailpitMailer(config.mail.url),
  logger: { level: config.LOG_LEVEL },
  ...(config.TRUSTED_PROXIES ? { trustedProxies: config.TRUSTED_PROXIES } : {}),
  ...(existsSync(config.WEB_DIST_DIR) ? { webDistDir: config.WEB_DIST_DIR } : {}),
});

// N-02: dane po terminie z inwentarza (data-model.md) sprzątane raz na dobę.
scheduleCleanup(app, { pool, clock: systemClock });

app.addHook("onClose", async () => {
  await pool.end();
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void app.close();
  });
}

await app.listen({ port: config.PORT, host: config.HOST });
