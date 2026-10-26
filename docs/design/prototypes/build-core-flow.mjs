// Buduje core-flow.html z core-flow.src.html, wstawiając tokeny z docs/design/tokens.json jako zmienne CSS.
// Użycie: node docs/design/prototypes/build-core-flow.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const tokens = JSON.parse(readFileSync(join(here, "..", "tokens.json"), "utf8"));
const vars = [];
const css = (v) => {
  if (Array.isArray(v)) return v.map((f) => (/\s/.test(f) ? `"${f}"` : f)).join(", ");
  if (v && typeof v === "object") return `${v.offsetX} ${v.offsetY} ${v.blur} ${v.spread} ${v.color}`;
  return String(v);
};
(function walk(node, path) {
  if (node && typeof node === "object" && "$value" in node) return vars.push(`  --${path.join("-")}: ${css(node.$value)};`);
  for (const [k, v] of Object.entries(node)) if (!k.startsWith("$")) walk(v, [...path, k]);
})(tokens, []);
const src = readFileSync(join(here, "core-flow.src.html"), "utf8");
writeFileSync(join(here, "core-flow.html"), src.replace("/*TOKENS*/", `:root {\n${vars.join("\n")}\n}`));
console.log(`core-flow.html: ${vars.length} tokenów`);
