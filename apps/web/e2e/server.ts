// Serwer E2E: czysty PostgreSQL w kontenerze, migracje, potem zbudowane API serwujące apps/web/dist.
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, openSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { POSTGRES_IMAGE } from "../../api/test/database-constants";

const apiDir = fileURLToPath(new URL("../../api", import.meta.url));
const port = process.env["E2E_PORT"] ?? "3100";

const container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
const env = {
  ...process.env,
  DATABASE_URL: container.getConnectionUri(),
  PORT: port,
  HOST: "127.0.0.1",
};

// pnpm na Windows to skrypt .cmd, który wymaga powłoki.
const migrated = spawnSync("pnpm db:migrate", { cwd: apiDir, env, stdio: "inherit", shell: true });
if (migrated.status !== 0) throw new Error("migrations failed");

// Log API w pliku do wglądu po przebiegu (test-results/api.log).
mkdirSync("test-results", { recursive: true });
const apiLog = openSync("test-results/api.log", "w");
const api = spawn("node", ["dist/server.js"], {
  cwd: apiDir,
  env,
  stdio: ["ignore", apiLog, apiLog],
});

async function stop(): Promise<void> {
  api.kill();
  await container.stop();
  process.exit(0);
}
process.once("SIGINT", () => void stop());
process.once("SIGTERM", () => void stop());
api.once("exit", () => void stop());
