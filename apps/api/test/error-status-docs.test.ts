import { readFileSync } from "node:fs";
import { DOMAIN_ERROR_CODES } from "@lista/shared";
import { describe, expect, it } from "vitest";
import { DOMAIN_STATUS } from "../src/http/api-error";

// T-105: status HTTP kodu domeny w tabeli błędów `architecture.md` jest tym, który wysyła handler
// błędów. Obecność kodów w obu dokumentach sprawdza `packages/shared/test/error-codes-docs.test.ts`.

/** Statusy z kolumny HTTP tabeli „Konwencje API i błędów” dla każdego kodu z kolumny `code`. */
function documentedStatuses(): Map<string, number[]> {
  const text = readFileSync(
    new URL("../../../docs/architecture/architecture.md", import.meta.url),
    "utf8",
  );
  const start = text.indexOf("## Konwencje API i błędów");
  const section = text.slice(start, text.indexOf("\n## ", start + 1));
  const statuses = new Map<string, number[]>();
  for (const row of section.split(/\r?\n/).filter((line) => /^\| \d/.test(line))) {
    const [http = "", code = ""] = row.replace(/\\\|/g, "/").split("|").slice(1);
    const rowStatuses = [...http.matchAll(/\d{3}/g)].map((m) => Number(m[0]));
    for (const [, name = ""] of code.replace(/\([^)]*\)/g, "").matchAll(/`([a-z_]+)`/g)) {
      statuses.set(name, [...(statuses.get(name) ?? []), ...rowStatuses]);
    }
  }
  return statuses;
}

describe("statusy kodów domeny w architecture.md (T-105)", () => {
  it.each(DOMAIN_ERROR_CODES)("`%s`: tabela błędów podaje status z `DOMAIN_STATUS`", (code) => {
    expect(documentedStatuses().get(code), `status \`${code}\` w tabeli błędów`).toEqual([
      DOMAIN_STATUS[code],
    ]);
  });
});
