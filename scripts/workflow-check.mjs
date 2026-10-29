#!/usr/bin/env node
// workflow-check (T-013): odrzuca workflow GitHub Actions ze znacznikiem TYMCZASOWE. Tymczasowe obejście
// w workflow (np. dodatkowy wyzwalacz wdrożenia) nie może trafić do main.
//
// Usage:
//   node scripts/workflow-check.mjs          # sprawdza .github/workflows
//   node scripts/workflow-check.mjs <dir>    # inny katalog (testy)
//
// Exit code 1, gdy znacznik występuje.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2] ?? ".github/workflows";
const findings = [];
for (const name of readdirSync(dir).filter((n) => /\.ya?ml$/.test(n))) {
  readFileSync(join(dir, name), "utf8")
    .split("\n")
    .forEach((line, i) => {
      if (line.includes("TYMCZASOWE"))
        findings.push(`${join(dir, name)}:${i + 1}: TYMCZASOWE — ${line.trim()}`);
    });
}

if (findings.length > 0) {
  console.error("Tymczasowe obejścia w workflow (usuń przed merge do main):");
  for (const f of findings) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`workflow-check: OK (${dir})`);
