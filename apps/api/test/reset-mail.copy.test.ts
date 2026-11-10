import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { passwordResetMail } from "../src/modules/konta/domain/reset-mail";

// T-115: tekst maila resetu (jedyny tekst po polsku tworzony przez API) jest tym z Copy SC-03.
// Wiersz Copy z dopiskiem `mail z API` test web zwalnia bez sprawdzenia (nie czyta kodu `apps/api`,
// `apps/web/test/copyRegister.ts`), więc sprawdza go ten test: każdy taki wiersz w specyfikacjach
// ekranów ma swój tekst w mailu z API, a mail nie ma tekstu bez wiersza. Komórka pasuje w całości,
// co do znaku; dopisek ` (…)` na końcu się nie liczy, link w treści to `{link}`.

const SCREENS_DOCS = new URL("../../../docs/design/screens/", import.meta.url);

/** Dopisek `mail z API` jako osobny segment (na początku albo po `; ` / `, `), jak w teście web. */
const MAIL_FROM_API = /(?:^\(|[;,] )mail z API(?=[;,)])/;

/** Dopisek na końcu komórki: nawias po spacji z `:`, `;` albo ID zadania (jak w teście web). */
const NOTE = / \((?=[^()]*(?:[:;]|T-\d{3}))[^()]*\)$/;

/** Wiersze Copy z dopiskiem `mail z API` ze wszystkich specyfikacji: `SC-03 · klucz` → tekst. */
function mailRowsInCopy(): Record<string, string> {
  const rows: Record<string, string> = {};
  for (const name of readdirSync(SCREENS_DOCS)
    .filter((file) => file.endsWith(".md"))
    .sort()) {
    const screen = name.slice(0, 5);
    const lines = readFileSync(new URL(name, SCREENS_DOCS), "utf8").split(/\r?\n/);
    const start = lines.findIndex((line) => /^## Copy\s*$/.test(line));
    if (start < 0) continue;
    for (const line of lines.slice(start + 1)) {
      if (line.startsWith("## ")) break;
      const [key, cell] = line
        .slice(1)
        .split(/(?<!\\)\|/)
        .map((part) => part.trim());
      const note = cell === undefined ? "" : (NOTE.exec(cell)?.[0].trim() ?? "");
      if (key && cell && MAIL_FROM_API.test(note))
        rows[`${screen} · ${key}`] = cell.replace(NOTE, "");
    }
  }
  return rows;
}

describe("mail resetu hasła a Copy SC-03 (T-115)", () => {
  it("temat i treść maila są wierszami Copy SC-03 `mail.subject` i `mail.body`; innych wierszy `mail z API` nie ma", () => {
    const mail = passwordResetMail("https://lista.example", "ola@example.com", "TOKEN");
    const link = "https://lista.example/reset-hasla?token=TOKEN";

    expect(mail.text).toContain(link);
    expect(mailRowsInCopy()).toEqual({
      "SC-03 · mail.subject": mail.subject,
      "SC-03 · mail.body": mail.text.replace(link, "{link}"),
    });
  });
});
