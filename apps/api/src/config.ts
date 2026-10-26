import { fileURLToPath } from "node:url";
import { z } from "zod";

const environmentSchema = z.object({
  DATABASE_URL: z.url(),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().min(1).default("127.0.0.1"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  // src/ i dist/ leżą na tej samej głębokości, więc domyślna ścieżka działa w dev i po buildzie.
  WEB_DIST_DIR: z
    .string()
    .min(1)
    .default(fileURLToPath(new URL("../../web/dist", import.meta.url))),
});

export type Config = z.infer<typeof environmentSchema>;

export function readConfig(environment: NodeJS.ProcessEnv): Config {
  const blankAsMissing = Object.fromEntries(
    Object.entries(environment).filter(([, value]) => value !== ""),
  );
  return environmentSchema.parse(blankAsMissing);
}
