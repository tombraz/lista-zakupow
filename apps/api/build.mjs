// Pakiety workspace (@lista/*) są w TypeScripcie, więc trafiają do bundla; zależności npm zostają zewnętrzne.
import { readFileSync } from "node:fs";
import { build } from "esbuild";

const { dependencies } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
);

await build({
  // dist/db/migrate.js leży na tej samej głębokości co src/db/, więc ścieżka do drizzle/ działa
  // także po buildzie (release_command Fly w obrazie, T-010).
  entryPoints: { server: "src/server.ts", "db/migrate": "src/db/migrate-cli.ts" },
  outdir: "dist",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  external: Object.keys(dependencies).filter((name) => !name.startsWith("@lista/")),
});
