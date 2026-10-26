// Pakiety workspace (@lista/*) są w TypeScripcie, więc trafiają do bundla; zależności npm zostają zewnętrzne.
import { readFileSync } from "node:fs";
import { build } from "esbuild";

const { dependencies } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
);

await build({
  entryPoints: ["src/server.ts"],
  outfile: "dist/server.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  external: Object.keys(dependencies).filter((name) => !name.startsWith("@lista/")),
});
