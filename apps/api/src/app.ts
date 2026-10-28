import Fastify, { type FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { systemClock, type Clock } from "./clock";
import { securityHeaders } from "./http/security-headers";
import { trustedOrigin } from "./http/trusted-origin";
import { webApp } from "./http/web-app";
import { loggingOptions, type LogSettings } from "./logging";
import { apiErrors } from "./http/api-error";
import { healthRoutes } from "./modules/health";
import { accountRoutes, type AuthSettings } from "./modules/konta";
import { listsModule } from "./modules/listy";
import { createItems, itemsModule } from "./modules/pozycje";
import { invitationsModule } from "./modules/zaproszenia";

// TH-13: żadna trasa nie potrzebuje więcej niż 16 kB treści.
const BODY_LIMIT_BYTES = 16 * 1024;

export interface AppOptions {
  pool: Pool;
  auth: AuthSettings;
  webDistDir?: string;
  /** Adresy / CIDR zaufanych proxy przed API; od nich adres klienta dla limitów per IP. */
  trustedProxies?: string;
  logger?: LogSettings;
  /** Czas dla domeny (odhaczenie, aktywność dzienna, wygasanie zaproszeń); testy podają własny. */
  clock?: Clock;
}

export function buildApp(options: AppOptions): FastifyInstance {
  const app = Fastify({
    ...loggingOptions(options.logger),
    bodyLimit: BODY_LIMIT_BYTES,
    ...(options.trustedProxies ? { trustProxy: options.trustedProxies } : {}),
  });
  watchPool(app, options.pool);
  apiErrors(app);
  securityHeaders(app);
  trustedOrigin(app, options.auth.origin);
  healthRoutes(app, options.pool);
  const accounts = accountRoutes(app, options.pool, options.auth);
  // Pozycje zależą od dostępu do listy, a szczegóły listy pokazują pozycje (ListItems).
  const lists = listsModule(app, options.pool, accounts, createItems(options.pool));
  const clock = options.clock ?? systemClock;
  itemsModule(app, options.pool, { accounts, lists, clock });
  invitationsModule(app, options.pool, {
    accounts,
    lists,
    clock,
    webOrigin: options.auth.origin,
  });
  webApp(app, options.webDistDir);
  return app;
}

// Baza zrywa bezczynne połączenie (restart, uśpienie Neona): pg usuwa je z puli, a bez
// nasłuchu zdarzenie „error” zabiłoby proces API.
function watchPool(app: FastifyInstance, pool: Pool): void {
  const onError = (error: Error) => {
    app.log.warn({ err: error }, "idle database connection lost");
  };
  pool.on("error", onError);
  app.addHook("onClose", () => {
    pool.off("error", onError);
  });
}
