import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "../src";

// T-095: kontrakt błędów w dokumentacji zgodny z `ErrorCode` (zastępuje ręczną regułę z
// `layers/backend.md`). Liczą się tylko komórki tabel: kod w przykładzie formatu albo w prozie
// nie jest opisem, kiedy wraca.

function doc(name: string): string {
  return readFileSync(new URL(`../../../docs/architecture/${name}`, import.meta.url), "utf8");
}

/** Komórki wierszy tabel Markdown (bez wierszy rozdzielających); `\|` nie dzieli komórek. */
function tableCells(markdown: string): string[][] {
  return markdown
    .split(/\r?\n/)
    .filter((line) => line.startsWith("|") && !/^\|[\s|:-]+\|$/.test(line))
    .map((line) =>
      line
        .replace(/\\\|/g, "/")
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim()),
    );
}

/** Kody zapisane jako samodzielny `kod` w komórce. */
function codesIn(cells: string[]): Set<string> {
  return new Set(
    cells.flatMap((cell) => [...cell.matchAll(/`([a-z_]+)`/g)].map((m) => m[1] ?? "")),
  );
}

/** Kody z kolumny `code` tabeli błędów w sekcji „Konwencje API i błędów” `architecture.md`. */
function architectureErrorTableCodes(): Set<string> {
  const text = doc("architecture.md");
  const start = text.indexOf("## Konwencje API i błędów");
  expect(start, "brak sekcji „Konwencje API i błędów” w architecture.md").toBeGreaterThanOrEqual(0);
  const end = text.indexOf("\n## ", start + 1);
  const [header, ...rows] = tableCells(text.slice(start, end === -1 ? undefined : end));
  expect(header, "brak tabeli błędów w „Konwencje API i błędów”").toEqual([
    "HTTP",
    "`code`",
    "Kiedy",
  ]);
  return codesIn(rows.map((row) => row[1] ?? ""));
}

function apiTableCodes(): Set<string> {
  return codesIn(tableCells(doc("api.md")).flat());
}

describe("kody błędów API w dokumentacji (T-095)", () => {
  const architecture = architectureErrorTableCodes();
  const api = apiTableCodes();

  it.each(ERROR_CODES)("architecture.md: tabela błędów ma wiersz dla `%s`", (code) => {
    expect(architecture.has(code), `brak \`${code}\` w kolumnie \`code\` tabeli błędów`).toBe(true);
  });

  it.each(ERROR_CODES)("api.md: tabela opisuje `%s`", (code) => {
    expect(api.has(code), `brak \`${code}\` w żadnej tabeli api.md`).toBe(true);
  });
});
