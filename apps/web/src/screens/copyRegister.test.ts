/**
 * Copy jest pełnym rejestrem tekstów ekranu (T-100, decyzja właściciela 2026-11-05): każdy tekst
 * ekranu web ma wiersz w tabeli „## Copy” swojej specyfikacji (`docs/design/screens/SC-xx-*.md`).
 *
 * Sposób (`test/copyRegister.ts`, parser pakietu `typescript`):
 * - Teksty ekranu to literały (string i szablon) z całego `screens/SC-xx-…/messages.ts` oraz teksty
 *   deklaracji, które pliki katalogu ekranu importują z modułów wspólnych, także pośrednio przez
 *   inne moduły (np. `errorText()` → wspólny `network`). Liczy się importowany symbol, nie cały
 *   moduł: ekran, który importuje `errorText`, nie musi mieć `HIDDEN_CHARACTERS_TEXT`.
 * - Moduł wspólny `.ts` ma teksty, gdy któryś jego literał wygląda na tekst interfejsu (polska litera
 *   albo słowo z wielkiej litery i kolejne słowo); wtedy liczy się każdy literał użytej deklaracji.
 *   Pliki `.tsx` tylko prowadzą importy: teksty w JSX są poza zakresem T-100.
 * - Nie są tekstem: ścieżki importów, typy, klucze obiektów i indeksów, kody porównywane (`===`,
 *   `case`), literały bez litery (pusty, separator) i komentarze.
 * - Parametr szablonu `${…}` pasuje do dowolnego `{nazwa}` w Copy (`${String(count)} do kupienia`
 *   ↔ `{n} do kupienia`). Stała z pakietu (`NAME_MAX_LENGTH`, `BUSINESS_LIMITS.itemsPerList`) jest
 *   rozwijana do wartości, więc Copy ma liczbę (`najwyżej 30 znaków`), nie `{n}`.
 * - Komórka Copy pasuje tylko w całości, co do znaku. Dopisek na końcu (` (…)` z `:`, `;` albo ID
 *   zadania, np. „(zatwierdzone 2026-11-05, T-100)”) się nie liczy; klucz `a / b` dzieli komórkę
 *   na teksty rozdzielone „ / ”; `\|` to znak `|` w treści.
 * - Import, którego test nie rozpoznaje, i ekran bez specyfikacji albo bez sekcji Copy to błąd.
 *   Test nie ma listy wyjątków ani pominiętych ekranów.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import * as shared from "@lista/shared";
import { describe, expect, it } from "vitest";
import { findCopyGaps, formatCopyGaps } from "../../test/copyRegister";

const SRC = join(import.meta.dirname, "..");
const SCREENS_DOCS = join(import.meta.dirname, "../../../../docs/design/screens");

function filesIn(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" }).map((file) => join(dir, file));
}

function repoSources(): Record<string, string> {
  const sources: Record<string, string> = {};
  for (const file of filesIn(SRC).filter((path) => /\.tsx?$/.test(path))) {
    sources[relative(SRC, file).replaceAll("\\", "/")] = readFileSync(file, "utf8");
  }
  return sources;
}

function repoSpecs(): Record<string, string> {
  const specs: Record<string, string> = {};
  for (const file of filesIn(SCREENS_DOCS).filter((path) => path.endsWith(".md"))) {
    specs[relative(SCREENS_DOCS, file)] = readFileSync(file, "utf8");
  }
  return specs;
}

describe("Copy register of web screens (repo)", () => {
  it("every text of screens SC-01–SC-09 has a row in its Copy table", () => {
    const sources = repoSources();
    const screens = new Set(
      Object.keys(sources).flatMap((file) => /^screens\/(SC-\d{2})-/.exec(file)?.[1] ?? []),
    );
    const gaps = findCopyGaps({
      sources,
      specs: repoSpecs(),
      packages: { "@lista/shared": shared },
    });

    expect([...screens]).toEqual(
      expect.arrayContaining([
        "SC-01",
        "SC-02",
        "SC-03",
        "SC-04",
        "SC-05",
        "SC-06",
        "SC-07",
        "SC-08",
        "SC-09",
      ]),
    );
    expect(formatCopyGaps(gaps)).toBe(formatCopyGaps([]));
  });
});

function spec(...rows: [string, string][]): string {
  const body = rows.map(([key, text]) => `| ${key} | ${text} |`).join("\n");
  return `# SC-01\n\n## Layout\n\nx\n\n## Copy\n\n| Key | Text |\n| --- | --- |\n${body}\n\n## Accessibility\n`;
}

describe("findCopyGaps (fixtures)", () => {
  it("reports every text of messages.ts without a Copy row, with screen and file", () => {
    const gaps = findCopyGaps({
      sources: {
        "screens/SC-01-logowanie/messages.ts": `
          import { x } from "../../api/client";
          export const messages = {
            title: "Zaloguj się",
            forgot: "Nie pamiętasz hasła?",
            register: "Załóż konto",
          };`,
        "api/client.ts": `export const x = 1;`,
      },
      specs: { "SC-01-logowanie.md": spec(["title", "Zaloguj się"]) },
    });

    expect(gaps).toEqual([
      {
        screen: "SC-01",
        file: "screens/SC-01-logowanie/messages.ts",
        text: "Nie pamiętasz hasła?",
      },
      { screen: "SC-01", file: "screens/SC-01-logowanie/messages.ts", text: "Załóż konto" },
    ]);
  });

  it("formats all gaps in one message: screen, source file and missing text", () => {
    const message = formatCopyGaps([
      { screen: "SC-01", file: "screens/SC-01-logowanie/messages.ts", text: "Załóż konto" },
      { screen: "SC-06", file: "errorText.ts", text: "Brak połączenia." },
    ]);

    expect(message).toBe(
      [
        "Teksty bez wiersza w tabeli Copy specyfikacji ekranu (docs/design/screens):",
        "SC-01 · screens/SC-01-logowanie/messages.ts · „Załóż konto”",
        "SC-06 · errorText.ts · „Brak połączenia.”",
      ].join("\n"),
    );
  });

  it("import paths, object keys, types, index keys, compared codes and `new` arguments are not texts", () => {
    const gaps = findCopyGaps({
      sources: {
        "screens/SC-01-logowanie/messages.ts": `
          import type { Code } from "@lista/shared";
          // „komentarz” nie jest tekstem
          type Field = "name" | "email";
          export const messages = { "quoted-key": "Imię", label: "E-mail" } satisfies Record<string, "x" | string>;
          export function pick(code: Code, all: Record<string, string>): string {
            if (code === "too_long") return all["name"] ?? "";
            switch (code) { case "invalid": return "Imię"; }
          const date = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "long" });
            return "E-mail";
          }`,
      },
      specs: { "SC-01-logowanie.md": spec(["name", "Imię"], ["email", "E-mail"]) },
    });

    expect(gaps).toEqual([]);
  });

  it("a template parameter matches any {name} in Copy; package constants are expanded", () => {
    const gaps = findCopyGaps({
      sources: {
        "screens/SC-01-logowanie/messages.ts": `
          import { NAME_MAX_LENGTH, LIMITS } from "@lista/shared";
          export const messages = {
            toBuy: (count: number) => \`\${String(count)} do kupienia\`,
            by: (p: { name: string } | null) => \`dodał(a) \${p?.name ?? "usunięty użytkownik"}\`,
            name: \`Imię może mieć najwyżej \${String(NAME_MAX_LENGTH)} znaków\`,
            limit: \`Lista ma \${String(LIMITS.items)} pozycji\`,
            note: \`Notatka może mieć najwyżej \${String(NAME_MAX_LENGTH)} znaków\`,
          };`,
      },
      specs: {
        "SC-01-logowanie.md": spec(
          ["toBuy", "{n} do kupienia"],
          ["addedBy", "dodał(a) {imię}"],
          ["deletedUser", "usunięty użytkownik"],
          ["name", "Imię może mieć najwyżej 30 znaków"],
          ["limit", "Lista ma 500 pozycji"],
          ["note", "Notatka może mieć najwyżej {n} znaków"],
        ),
      },
      packages: { "@lista/shared": { NAME_MAX_LENGTH: 30, LIMITS: { items: 500 } } },
    });

    expect(gaps.map((gap) => gap.text)).toEqual(["Notatka może mieć najwyżej 30 znaków"]);
  });

  it("reads Copy cells: note in brackets, `a / b` keys, escaped pipe; no partial match", () => {
    const gaps = findCopyGaps({
      sources: {
        "screens/SC-01-logowanie/messages.ts": `
          export const messages = {
            hidden: "Usuń niewidoczne lub specjalne znaki.",
            show: "Pokaż", hide: "Ukryj",
            note: "Ilość / notatka (opcjonalnie)",
            bought: (n: number) => \`Kupione (\${String(n)})\`,
            pipe: "a | b",
            add: "Dodaj",
            and: "i",
            heading: "Kupione",
          };`,
      },
      specs: {
        "SC-01-logowanie.md": spec(
          [
            "hidden",
            "Usuń niewidoczne lub specjalne znaki. (pod polem: imię; zatwierdzone 2026-11-01, T-060)",
          ],
          ["show / hide", "Pokaż / Ukryj"],
          ["note.label", "Ilość / notatka (opcjonalnie)"],
          ["bought", "Kupione ({n})"],
          ["pipe", "a \\| b"],
          ["add", "Dodaj (z Layout/States, T-100)"],
          ["consent", "Akceptuję regulamin i politykę prywatności."],
        ),
      },
    });

    expect(gaps.map((gap) => gap.text)).toEqual(["i", "Kupione"]);
  });

  it("texts of a shared module are required on each screen that imports them, and only there", () => {
    const gaps = findCopyGaps({
      sources: {
        "errorText.ts": `
          const COMMON = { network: "Brak połączenia. Sprawdź internet i spróbuj ponownie." };
          export function errorText(code: string, otherwise: string): string {
            return COMMON[code] ?? otherwise;
          }
          export const HIDDEN_CHARACTERS_TEXT = "Usuń niewidoczne lub specjalne znaki.";`,
        "api/client.ts": `
          export function apiRequest(path: string) {
            return fetch(path, { method: "POST", credentials: "same-origin" });
          }`,
        "screens/SC-01-logowanie/messages.ts": `
          import { errorText } from "../../errorText";
          export const formError = (code: string) => errorText(code, "Spróbuj ponownie.");`,
        "screens/SC-01-logowanie/useSignIn.ts": `
          import { apiRequest } from "../../api/client";
          export const signIn = () => apiRequest("/api/auth/sign-in/email");`,
        "screens/SC-05-moje-listy/messages.ts": `export const messages = { title: "Moje listy" };`,
        "screens/SC-05-moje-listy/NewListForm.tsx": `
          import { HIDDEN_CHARACTERS_TEXT } from "../../errorText";
          export const Form = () => <p>{HIDDEN_CHARACTERS_TEXT}</p>;`,
        "screens/SC-08-zaproszenie/messages.ts": `
          import type { errorText } from "../../errorText";
          export const messages = { title: "Zaproszenie" };`,
      },
      specs: {
        "SC-01-logowanie.md": spec(["error", "Spróbuj ponownie."]),
        "SC-05-moje-listy.md": spec(["title", "Moje listy"]),
        "SC-08-zaproszenie.md": spec(["title", "Zaproszenie"]),
      },
    });

    expect(gaps).toEqual([
      {
        screen: "SC-01",
        file: "errorText.ts",
        text: "Brak połączenia. Sprawdź internet i spróbuj ponownie.",
      },
      { screen: "SC-05", file: "errorText.ts", text: "Usuń niewidoczne lub specjalne znaki." },
    ]);
  });

  it("texts of a shared module imported indirectly (module → module → screen) are required", () => {
    const gaps = findCopyGaps({
      sources: {
        "errorText.ts": `export const HIDDEN_CHARACTERS_TEXT = "Usuń niewidoczne lub specjalne znaki.";`,
        "session/personName.ts": `
          import { NAME_MAX_LENGTH } from "@lista/shared";
          import { HIDDEN_CHARACTERS_TEXT } from "../errorText";
          export const NAME_ERROR_TEXTS = {
            required: "Wpisz imię",
            invalid: HIDDEN_CHARACTERS_TEXT,
            too_long: \`Imię może mieć najwyżej \${String(NAME_MAX_LENGTH)} znaków\`,
          };`,
        "lists/listName.ts": `
          export function listNameErrorText(code: string): string {
            return code === "too_long" ? "Nazwa listy jest za długa" : "Wpisz nazwę listy";
          }`,
        "lists/ListNameField.tsx": `
          import { listNameErrorText } from "./listName";
          export const ListNameField = () => <p>{listNameErrorText("x")}</p>;`,
        "screens/SC-05-moje-listy/messages.ts": `export const messages = {};`,
        "screens/SC-05-moje-listy/NewListForm.tsx": `
          import { ListNameField } from "../../lists/ListNameField";
          export const NewListForm = () => <ListNameField />;`,
        "screens/SC-09-konto/messages.ts": `export const messages = {};`,
        "screens/SC-09-konto/NameForm.tsx": `
          import { NAME_ERROR_TEXTS } from "../../session/personName";
          export const NameForm = () => <p>{NAME_ERROR_TEXTS.required}</p>;`,
      },
      specs: {
        "SC-05-moje-listy.md": spec(["new.error", "Wpisz nazwę listy"]),
        "SC-09-konto.md": spec(["name.required", "Wpisz imię"]),
      },
      packages: { "@lista/shared": { NAME_MAX_LENGTH: 30 } },
    });

    expect(gaps).toEqual([
      { screen: "SC-05", file: "lists/listName.ts", text: "Nazwa listy jest za długa" },
      { screen: "SC-09", file: "session/personName.ts", text: "Imię może mieć najwyżej 30 znaków" },
      { screen: "SC-09", file: "errorText.ts", text: "Usuń niewidoczne lub specjalne znaki." },
    ]);
  });

  it("in a shared module only literals that look like interface text count (not field keys)", () => {
    const gaps = findCopyGaps({
      sources: {
        "lists/listName.ts": `
          export function useListNameForm(focusField: (field: string) => void) {
            focusField("name");
            return "Wpisz nazwę listy";
          }`,
        "screens/SC-05-moje-listy/messages.ts": `export const messages = {};`,
        "screens/SC-05-moje-listy/useNewList.ts": `
          import { useListNameForm } from "../../lists/listName";
          export const useNewList = () => useListNameForm(() => undefined);`,
      },
      specs: { "SC-05-moje-listy.md": spec() },
    });

    expect(gaps.map((gap) => gap.text)).toEqual(["Wpisz nazwę listy"]);
  });

  it("an import or a screen the test cannot resolve is an error, not a silent skip", () => {
    const unresolved = () =>
      findCopyGaps({
        sources: {
          "screens/SC-01-logowanie/messages.ts": `import { x } from "../../brak"; export const m = x;`,
        },
        specs: { "SC-01-logowanie.md": spec() },
      });
    const noSpec = () =>
      findCopyGaps({
        sources: { "screens/SC-10-nowy/messages.ts": `export const m = { a: "Nowy ekran" };` },
        specs: {},
      });

    expect(unresolved).toThrow(
      "screens/SC-01-logowanie/messages.ts: nie rozpoznano importu „../../brak”",
    );
    expect(noSpec).toThrow("SC-10: brak specyfikacji ekranu");
  });

  it("CRLF line endings in the spec give the same result as LF", () => {
    const input = (markdown: string) => ({
      sources: { "screens/SC-01-logowanie/messages.ts": `export const m = { a: "Wpisz hasło" };` },
      specs: { "SC-01-logowanie.md": markdown },
    });
    const lf = spec(["password.required", "Wpisz hasło (z Layout/States, T-100)"]);

    expect(findCopyGaps(input(lf.replaceAll("\n", "\r\n")))).toEqual([]);
    expect(findCopyGaps(input(lf))).toEqual([]);
  });

  it("a Copy row differing by one character (final full stop) does not match", () => {
    const gaps = findCopyGaps({
      sources: {
        "screens/SC-01-logowanie/messages.ts": `export const messages = { a: "Hasło zmienione." };`,
      },
      specs: { "SC-01-logowanie.md": spec(["a", "Hasło zmienione"]) },
    });

    expect(gaps.map((gap) => gap.text)).toEqual(["Hasło zmienione."]);
  });
});
