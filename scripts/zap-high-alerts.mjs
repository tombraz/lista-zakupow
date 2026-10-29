// Próg ZAP (T-010, AC4): każdy alert wysoki (riskcode 3) w raporcie JSON zap-baseline.py = porażka.
//   node scripts/zap-high-alerts.mjs zap-report/report.json
import { readFileSync } from "node:fs";

const HIGH = "3";
const report = JSON.parse(readFileSync(process.argv[2], "utf8"));
const high = (report.site ?? []).flatMap((site) =>
  (site.alerts ?? [])
    .filter((alert) => alert.riskcode === HIGH)
    .map((alert) => `${site["@name"]}: ${alert.pluginid} ${alert.alert}`),
);

if (high.length > 0) {
  console.error(`ZAP: ${high.length} alertów wysokich`);
  for (const line of high) console.error(`  ${line}`);
  process.exit(1);
}
console.log("ZAP: brak alertów wysokich");
