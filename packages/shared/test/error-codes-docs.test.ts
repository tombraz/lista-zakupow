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

/**
 * Kody zapisane jako samodzielny `kod` w komórce. Nawias to pola kodu (`limit`: `lists`,
 * `requestId`), nie kolejne kody (T-105).
 */
function codesIn(cells: string[]): Set<string> {
  return new Set(
    cells.flatMap((cell) =>
      [...cell.replace(/\([^)]*\)/g, "").matchAll(/`([a-z_]+)`/g)].map((m) => m[1] ?? ""),
    ),
  );
}

const ERROR_TABLE_HEADER = ["HTTP", "`code`", "Kiedy"];

/**
 * Tabela błędów z sekcji „Konwencje API i błędów” w `architecture.md`. Bez `expect` i czytana
 * dopiero w teście: brak sekcji lub inny nagłówek ma paść w nazwanym teście, nie przy zbieraniu
 * testów pliku (QA T-095).
 */
function architectureErrorTable(): { header: string[] | undefined; codes: Set<string> } {
  const text = doc("architecture.md");
  const start = text.indexOf("## Konwencje API i błędów");
  if (start === -1) return { header: undefined, codes: new Set() };
  const end = text.indexOf("\n## ", start + 1);
  const [header, ...rows] = tableCells(text.slice(start, end === -1 ? undefined : end));
  if (header?.join("|") !== ERROR_TABLE_HEADER.join("|")) return { header, codes: new Set() };
  return { header, codes: codesIn(rows.map((row) => row[1] ?? "")) };
}

function apiTableCodes(): Set<string> {
  return codesIn(tableCells(doc("api.md")).flat());
}

describe("kody błędów API w dokumentacji (T-095)", () => {
  it("architecture.md: sekcja „Konwencje API i błędów” ma tabelę z kolumną `code`", () => {
    expect(architectureErrorTable().header, "brak sekcji albo inny nagłówek tabeli błędów").toEqual(
      ERROR_TABLE_HEADER,
    );
  });

  it.each(ERROR_CODES)("architecture.md: tabela błędów ma wiersz dla `%s`", (code) => {
    const { codes } = architectureErrorTable();
    expect(codes.has(code), `brak \`${code}\` w kolumnie \`code\` tabeli błędów`).toBe(true);
  });

  it("architecture.md: każdy kod w kolumnie `code` tabeli błędów jest w `ERROR_CODES` (T-105)", () => {
    const known = new Set<string>(ERROR_CODES);
    const unknown = [...architectureErrorTable().codes].filter((code) => !known.has(code));
    expect(unknown, "kody w tabeli błędów spoza `ERROR_CODES`").toEqual([]);
  });

  it.each(ERROR_CODES)("api.md: tabela opisuje `%s`", (code) => {
    expect(apiTableCodes().has(code), `brak \`${code}\` w żadnej tabeli api.md`).toBe(true);
  });
});
