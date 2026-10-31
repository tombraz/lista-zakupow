import type { Pool } from "pg";
import { buildApp, type AppOptions } from "../src/app";

export const TEST_ORIGIN = "http://localhost:5173";
export const TEST_SECRET = "test-secret-only-for-integration-tests-0123456789";

/** Aplikacja jak w produkcji, z originem i sekretem testowym. */
export function buildTestApp(pool: Pool, options: Partial<AppOptions> = {}) {
  return buildApp({ pool, auth: { secret: TEST_SECRET, origin: TEST_ORIGIN }, ...options });
}
