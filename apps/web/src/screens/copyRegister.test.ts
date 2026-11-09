/**
 * Copy jest pełnym rejestrem tekstów ekranu (T-100, decyzja właściciela 2026-11-05): każdy tekst
 * ekranu web ma wiersz w tabeli „## Copy” swojej specyfikacji (`docs/design/screens/SC-xx-*.md`).
 *
 * Sposób (`test/copyRegister.ts`, parser pakietu `typescript`):
 * - Teksty ekranu to literały (string i szablon) z całego `screens/SC-xx-…/messages.ts` oraz teksty
 *   deklaracji, które pliki katalogu ekranu importują z modułów wspólnych, także pośrednio przez
 *   inne moduły (np. `errorText()` → wspólny `network`). Liczy się importowany symbol, nie cały
 *   moduł: ekran, który importuje `errorText`, nie musi mieć `HIDDEN_CHARACTERS_TEXT`.
 * - Teksty modułu wspólnego (wszystko poza `screens/`, także komponenty design systemu w
 *   `components/`) są tylko w `<nazwa>Messages.ts` (np. `lists/leaveMessages.ts`), który liczy się
 *   jak `messages.ts`: każdy literał, także jednowyrazowy („Anuluj”; T-103, T-109). Wyświetlany
 *   literał w innym pliku `.ts` albo `.tsx` modułu wspólnego to błąd ze wskazaniem pliku,
 *   niezależnie od liczby słów i polskich znaków (T-109):
 *   - w JSX każdy literał z literą: tekst (`<span>Zamknij</span>`), wyrażenie (`{"Zamknij"}`),
 *     atrybut i props komponentu (`label="Zamknij"`, `aria-label="Zamknij"`; T-106, T-107), poza
 *     atrybutami kodu (`className`, `type`, `role`, `id`, `data-*`, `aria-*by`, `aria-controls`,
 *     `href`, `to`, `variant`, `tone`, `autoComplete`, `on…` itd.) i argumentami wywołań;
 *   - poza JSX każdy literał, który nie jest kodem: kod to jeden ciąg bez polskiej litery i bez
 *     słowa z wielkiej litery (`"name"`, `"listId"`, `"POST"`, `"/api/v1/lists"`, `"pl-PL"`);
 *     `{ cancel: "Anuluj" }` to tekst.
 *   Pliki `.tsx` tylko prowadzą importy. Teksty w `.tsx` katalogów ekranów są jeszcze poza testem.
 * - Tekst z pliku w `components/` pasuje do wiersza Copy ekranu albo do tabeli „## Copy”
 *   komponentów w `docs/design/design-system.md` (T-106); tekst spoza `components/` tylko do Copy
 *   ekranu. Wiersz Copy ekranu, który powtarza Copy komponentów tekstem, jaki ekran bierze tylko
 *   z `components/` (nie też z własnego pliku), to błąd: ekran nie powtarza wierszy komponentów
 *   (T-108).
 * - Wiersz Copy ekranu, którego tekstu nie pokazuje kod web ekranu (z importowanymi modułami
 *   wspólnymi i komponentami), to błąd ze wskazaniem ekranu i klucza (`findUnusedCopyRows`, T-111),
 *   chyba że dopisek podaje źródło jako osobny segment: `mail z API`, `mobile`, `złożony z części`
 *   (kod składa tekst z wierszy-części) albo `pokazuje SC-xx`. Martwy wiersz się usuwa.
 * - Nie są tekstem: ścieżki importów, typy, klucze obiektów i indeksów, kody porównywane (`===`,
 *   `case`), literały bez litery (pusty, separator) i komentarze.
 * - Parametr szablonu `${…}` pasuje do dowolnego `{nazwa}` w Copy (`${String(count)} do kupienia`
 *   ↔ `{n} do kupienia`). Stała z pakietu (`NAME_MAX_LENGTH`, `BUSINESS_LIMITS.itemsPerList`) i stała
 *   tego samego modułu z literałem (`PRODUCT_NAME`, T-109) są rozwijane do wartości, więc Copy ma
 *   wartość (`najwyżej 30 znaków`, `{tytuł} · Wspólna lista zakupów`), nie `{n}`.
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
import {
  findCopyGaps,
  findUnusedCopyRows,
  formatCopyGaps,
  formatUnusedCopyRows,
} from "../../test/copyRegister";

const SRC = join(import.meta.dirname, "..");
const SCREENS_DOCS = join(import.meta.dirname, "../../../../docs/design/screens");
const DESIGN_SYSTEM = join(import.meta.dirname, "../../../../docs/design/design-system.md");

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
      designSystem: readFileSync(DESIGN_SYSTEM, "utf8"),
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

  it("every Copy row of screens SC-01–SC-09 has its text in the screen code or a source note (T-111)", () => {
    const rows = findUnusedCopyRows({
      sources: repoSources(),
      specs: repoSpecs(),
      packages: { "@lista/shared": shared },
      designSystem: readFileSync(DESIGN_SYSTEM, "utf8"),
    });

    expect(formatUnusedCopyRows(rows)).toBe(formatUnusedCopyRows([]));
  });
});

const SHARED_TEXTS_HEADER =
  "Teksty interfejsu w modułach wspólnych poza plikiem <nazwa>Messages.ts (przenieś tekst do <nazwa>Messages.ts modułu, np. lists/leaveMessages.ts):";

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
        "errorTextMessages.ts": `
          export const COMMON_ERROR_TEXTS = { network: "Brak połączenia. Sprawdź internet i spróbuj ponownie." };
          export const HIDDEN_CHARACTERS_TEXT = "Usuń niewidoczne lub specjalne znaki.";`,
        "errorText.ts": `
          import { COMMON_ERROR_TEXTS } from "./errorTextMessages";
          export function errorText(code: string, otherwise: string): string {
            return COMMON_ERROR_TEXTS[code] ?? otherwise;
          }`,
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
          import { HIDDEN_CHARACTERS_TEXT } from "../../errorTextMessages";
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
        file: "errorTextMessages.ts",
        text: "Brak połączenia. Sprawdź internet i spróbuj ponownie.",
      },
      {
        screen: "SC-05",
        file: "errorTextMessages.ts",
        text: "Usuń niewidoczne lub specjalne znaki.",
      },
    ]);
  });

  it("texts of a shared module imported indirectly (module → module → screen) are required", () => {
    const gaps = findCopyGaps({
      sources: {
        "errorTextMessages.ts": `export const HIDDEN_CHARACTERS_TEXT = "Usuń niewidoczne lub specjalne znaki.";`,
        "session/personNameMessages.ts": `
          import { NAME_MAX_LENGTH } from "@lista/shared";
          import { HIDDEN_CHARACTERS_TEXT } from "../errorTextMessages";
          export const NAME_ERROR_TEXTS = {
            required: "Wpisz imię",
            invalid: HIDDEN_CHARACTERS_TEXT,
            too_long: \`Imię może mieć najwyżej \${String(NAME_MAX_LENGTH)} znaków\`,
          };`,
        "lists/listNameMessages.ts": `
          export function listNameErrorText(code: string): string {
            return code === "too_long" ? "Nazwa listy jest za długa" : "Wpisz nazwę listy";
          }`,
        "lists/ListNameField.tsx": `
          import { listNameErrorText } from "./listNameMessages";
          export const ListNameField = () => <p>{listNameErrorText("x")}</p>;`,
        "screens/SC-05-moje-listy/messages.ts": `export const messages = {};`,
        "screens/SC-05-moje-listy/NewListForm.tsx": `
          import { ListNameField } from "../../lists/ListNameField";
          export const NewListForm = () => <ListNameField />;`,
        "screens/SC-09-konto/messages.ts": `export const messages = {};`,
        "screens/SC-09-konto/NameForm.tsx": `
          import { NAME_ERROR_TEXTS } from "../../session/personNameMessages";
          export const NameForm = () => <p>{NAME_ERROR_TEXTS.required}</p>;`,
      },
      specs: {
        "SC-05-moje-listy.md": spec(["new.error", "Wpisz nazwę listy"]),
        "SC-09-konto.md": spec(["name.required", "Wpisz imię"]),
      },
      packages: { "@lista/shared": { NAME_MAX_LENGTH: 30 } },
    });

    expect(gaps).toEqual([
      { screen: "SC-05", file: "lists/listNameMessages.ts", text: "Nazwa listy jest za długa" },
      {
        screen: "SC-09",
        file: "session/personNameMessages.ts",
        text: "Imię może mieć najwyżej 30 znaków",
      },
      {
        screen: "SC-09",
        file: "errorTextMessages.ts",
        text: "Usuń niewidoczne lub specjalne znaki.",
      },
    ]);
  });

  it("code literals of a shared module (field keys, paths, methods, query keys) are not texts (T-109)", () => {
    const gaps = findCopyGaps({
      sources: {
        "lists/listNameMessages.ts": `export const LIST_NAME_REQUIRED = "Wpisz nazwę listy";`,
        "lists/listName.ts": `
          import { LIST_NAME_REQUIRED } from "./listNameMessages";
          export function useListNameForm(focusField: (field: string) => void) {
            focusField("name");
            const key = ["lists", "detail"];
            const save = () => apiRequest("/api/v1/lists", { method: "POST", credentials: "same-origin" });
            const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
            const initial = (name: string) => name.toLocaleUpperCase("pl-PL");
            const kind = reduced ? "text" : "password";
            return LIST_NAME_REQUIRED;
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

  it("interface text in a shared .tsx file (outside screens/, also components/) is an error naming the file", () => {
    const input = (dialog: string) => ({
      sources: {
        "lists/LeaveListDialog.tsx": dialog,
        "invitations/Notice.tsx": `export const Notice = () => <p role="status">Dołączasz   do listy</p>;`,
        "components/Banner.tsx": `export const Banner = () => <p role="status">Jesteś offline</p>;`,
        "components/Button.tsx": `export const Button = () => <button className="btn primary" type="button" />;`,
        "components/Close.tsx": `export const Close = () => <button type="button"><span aria-hidden="true">×</span> <span>Zamknij</span></button>;`,
        "screens/SC-07-uczestnicy/messages.ts": `export const messages = { title: "Uczestnicy" };`,
        "screens/SC-07-uczestnicy/Leave.tsx": `
          import { LeaveListDialog } from "../../lists/LeaveListDialog";
          export const Leave = () => <LeaveListDialog label="Opuść" />;`,
      },
      specs: { "SC-07-uczestnicy.md": spec(["title", "Uczestnicy"]) },
    });
    const withTexts = () =>
      findCopyGaps(
        input(`
          export const leaveMessages = { confirm: "Opuść", consequence: \`Żeby wrócić, potrzebujesz zaproszenia.\` };
          export const LeaveListDialog = () => <p>{leaveMessages.confirm}</p>;`),
      );

    expect(withTexts).toThrow(
      [
        SHARED_TEXTS_HEADER,
        "components/Banner.tsx · „Jesteś offline”",
        "components/Close.tsx · „Zamknij”",
        "invitations/Notice.tsx · „Dołączasz do listy”",
        "lists/LeaveListDialog.tsx · „Opuść”",
        "lists/LeaveListDialog.tsx · „Żeby wrócić, potrzebujesz zaproszenia.”",
      ].join("\n"),
    );
  });

  it("a text in a user-facing JSX attribute of a shared .tsx file is an error, also one word (T-107)", () => {
    const check = () =>
      findCopyGaps({
        sources: {
          "components/Modal/Modal.tsx": `
            export const Modal = () => (
              <div role="dialog" id="Main" className="Header" data-testid="Close" aria-labelledby="Title">
                <button type="button" aria-label="Zamknij" title="Menu" />
                <img alt={"Logo"} src="logo.svg" />
                <input placeholder="Szukaj" aria-description="Opis" />
                <span aria-label="" title="…" />
              </div>
            );`,
          "screens/SC-05-moje-listy/messages.ts": `export const messages = {};`,
        },
        specs: { "SC-05-moje-listy.md": spec() },
      });

    expect(check).toThrow(
      [
        SHARED_TEXTS_HEADER,
        "components/Modal/Modal.tsx · „Zamknij”",
        "components/Modal/Modal.tsx · „Menu”",
        "components/Modal/Modal.tsx · „Logo”",
        "components/Modal/Modal.tsx · „Szukaj”",
        "components/Modal/Modal.tsx · „Opis”",
      ].join("\n"),
    );
  });

  it("texts of a design system component match the component Copy in design-system.md or the screen Copy", () => {
    const sources = {
      "components/OfflineBanner/offlineBannerMessages.ts": `export const offlineBannerMessages = { offline: "Brak połączenia.", restored: "Połączenie przywrócone." };`,
      "components/OfflineBanner/OfflineBanner.tsx": `
        import { offlineBannerMessages } from "./offlineBannerMessages";
        export const OfflineBanner = () => <p>{offlineBannerMessages.offline}</p>;`,
      "components/PasswordField/passwordFieldMessages.ts": `export const passwordFieldMessages = { show: "Pokaż", hide: "Ukryj" };`,
      "components/PasswordField/PasswordField.tsx": `
        import { passwordFieldMessages } from "./passwordFieldMessages";
        export const PasswordField = () => <button>{passwordFieldMessages.show}</button>;`,
      "screens/SC-01-logowanie/messages.ts": `export const messages = { error: "Brak połączenia z kontem." };`,
      "screens/SC-01-logowanie/SignIn.tsx": `
        import { OfflineBanner } from "../../components/OfflineBanner/OfflineBanner";
        import { PasswordField } from "../../components/PasswordField/PasswordField";
        export const SignIn = () => <><OfflineBanner /><PasswordField /></>;`,
      "screens/SC-05-moje-listy/messages.ts": `export const messages = { title: "Moje listy" };`,
    };
    const designSystem = `# Design system

## Komponenty

### OfflineBanner

## Copy

| Key | Text |
| --- | --- |
| OfflineBanner.offline | Brak połączenia. (zatwierdzone 2026-11-06, T-106) |
| PasswordField.show / PasswordField.hide | Pokaż / Ukryj |

## Zasady dostępności

| a | Spoza Copy |
`;
    const gaps = findCopyGaps({
      sources,
      specs: {
        "SC-01-logowanie.md": spec(["error", "Brak połączenia z kontem."]),
        "SC-05-moje-listy.md": spec(["title", "Moje listy"], ["x", "Brak połączenia."]),
      },
      designSystem,
    });
    const screenRowOnly = findCopyGaps({
      sources: {
        ...sources,
        "screens/SC-01-logowanie/messages.ts": `export const messages = { a: "Brak połączenia." };`,
      },
      specs: {
        "SC-01-logowanie.md": spec(
          ["a", "Brak połączenia."],
          ["restored", "Połączenie przywrócone."],
        ),
        "SC-05-moje-listy.md": spec(["title", "Moje listy"]),
      },
      designSystem: designSystem.replace(
        "| PasswordField.show / PasswordField.hide | Pokaż / Ukryj |\n",
        "",
      ),
    });

    expect(gaps).toEqual([
      {
        screen: "SC-01",
        file: "components/OfflineBanner/offlineBannerMessages.ts",
        text: "Połączenie przywrócone.",
      },
    ]);
    expect(screenRowOnly.map((gap) => gap.text)).toEqual(["Pokaż", "Ukryj"]);
    expect(() => findCopyGaps({ sources, specs: {}, designSystem: "# Design system\n" })).toThrow(
      "design-system.md: brak sekcji „## Copy”",
    );
  });

  it("a screen text never matches the component Copy, only its own Copy table", () => {
    const gaps = findCopyGaps({
      sources: {
        "screens/SC-01-logowanie/messages.ts": `export const messages = { show: "Pokaż" };`,
      },
      specs: { "SC-01-logowanie.md": spec() },
      designSystem: "## Copy\n\n| Key | Text |\n| --- | --- |\n| PasswordField.show | Pokaż |\n",
    });

    expect(gaps.map((gap) => gap.text)).toEqual(["Pokaż"]);
  });

  it("a screen Copy row that repeats the component Copy for a text the screen takes only from components/ is an error (T-108)", () => {
    const sources = {
      "components/AuthPage/authPageMessages.ts": `export const authPageMessages = { legal: "Regulamin i polityka prywatności" };`,
      "components/AuthPage/AuthPage.tsx": `
        import { authPageMessages } from "./authPageMessages";
        export const AuthPage = () => <a>{authPageMessages.legal}</a>;`,
      "components/PasswordField/passwordFieldMessages.ts": `export const passwordFieldMessages = { show: "Pokaż" };`,
      "components/PasswordField/PasswordField.tsx": `
        import { passwordFieldMessages } from "./passwordFieldMessages";
        export const PasswordField = () => <button>{passwordFieldMessages.show}</button>;`,
      "screens/SC-01-logowanie/SignIn.tsx": `
        import { AuthPage } from "../../components/AuthPage/AuthPage";
        import { PasswordField } from "../../components/PasswordField/PasswordField";
        export const SignIn = () => <AuthPage><PasswordField /></AuthPage>;`,
      "screens/SC-06-lista/messages.ts": `export const messages = { show: "Pokaż" };`,
      "screens/SC-06-lista/List.tsx": `
        import { PasswordField } from "../../components/PasswordField/PasswordField";
        import { messages } from "./messages";
        export const List = () => <><PasswordField /><b>{messages.show}</b></>;`,
    };
    const designSystem =
      "## Copy\n\n| Key | Text |\n| --- | --- |\n| AuthPage.legal | Regulamin i polityka prywatności (z Copy SC-01, T-106) |\n| PasswordField.show | Pokaż |\n";
    const withRows = (...rows: [string, string][]) =>
      findCopyGaps({
        sources,
        specs: {
          "SC-01-logowanie.md": spec(...rows),
          "SC-06-lista.md": spec(["dup.show", "Pokaż"]),
        },
        designSystem,
      });

    expect(withRows()).toEqual([]);
    expect(() =>
      withRows(["legal", "Regulamin i polityka prywatności"], ["password.show", "Pokaż"]),
    ).toThrow(
      [
        "Wiersze Copy ekranu powtarzają tabelę „## Copy” komponentów w design-system.md (ekran nie powtarza wierszy komponentów; usuń wiersz z Copy ekranu):",
        "SC-01 · components/AuthPage/authPageMessages.ts · „Regulamin i polityka prywatności”",
        "SC-01 · components/PasswordField/passwordFieldMessages.ts · „Pokaż”",
      ].join("\n"),
    );
  });

  it("a shared *Messages.ts module counts every literal, like messages.ts (one-word „Anuluj”)", () => {
    const gaps = findCopyGaps({
      sources: {
        "lists/leaveMessages.ts": `export const leaveMessages = { confirm: "Opuść", cancel: "Anuluj", close: "Zamknij" };`,
        "screens/SC-07-uczestnicy/messages.ts": `
          import { leaveMessages } from "../../lists/leaveMessages";
          export const messages = { leave: leaveMessages };`,
      },
      specs: {
        "SC-07-uczestnicy.md": spec(["leave.confirm.cta", "Opuść"]),
      },
    });

    expect(gaps.map((gap) => `${gap.file} · ${gap.text}`)).toEqual([
      "lists/leaveMessages.ts · Anuluj",
      "lists/leaveMessages.ts · Zamknij",
    ]);
  });

  it("a shared .tsx file that only renders imported texts is not an error", () => {
    const gaps = findCopyGaps({
      sources: {
        "lists/leaveMessages.ts": `export const leaveMessages = { confirm: "Opuść" };`,
        "lists/LeaveListDialog.tsx": `
          import { leaveMessages } from "./leaveMessages";
          export const LeaveListDialog = () => <button className="btn primary">{leaveMessages.confirm}</button>;`,
        "lists/LeaveListDialog.test.tsx": `it("x", () => screen.getByText("Opuść listę"));`,
        "screens/SC-07-uczestnicy/messages.ts": `export const messages = {};`,
        "screens/SC-07-uczestnicy/Leave.tsx": `
          import { LeaveListDialog } from "../../lists/LeaveListDialog";
          export const Leave = () => <LeaveListDialog />;`,
      },
      specs: { "SC-07-uczestnicy.md": spec() },
    });

    expect(gaps).toEqual([{ screen: "SC-07", file: "lists/leaveMessages.ts", text: "Opuść" }]);
  });

  it("a displayed literal in a shared .tsx file is an error: object value, JSX expression, component prop (T-109)", () => {
    const check = () =>
      findCopyGaps({
        sources: {
          "lists/LeaveListDialog.tsx": `
            const t = { cancel: "Anuluj" };
            export const LeaveListDialog = ({ kind }: { kind: string }) => (
              <div role="dialog" className="row" id="leave" data-state="open" aria-labelledby="leave-title">
                <button type="button" className={"btn primary"} aria-describedby="hint" aria-controls="menu">{t.cancel}</button>
                <span>{"Zamknij"}</span>
                <MoreMenu label="Menu" tone="error" variant="danger" />
                <p>{"lub"}</p>
                <Tag text="ok" />
                <a href="/regulamin" target="_blank" rel="noopener">{kind === "owner" && <b />}</a>
                <Link to="/listy" />
                <input autoComplete="email" name="email" inputMode="email" aria-hidden="true" />
              </div>
            );`,
          "screens/SC-07-uczestnicy/messages.ts": `export const messages = {};`,
        },
        specs: { "SC-07-uczestnicy.md": spec() },
      });

    expect(check).toThrow(
      [
        SHARED_TEXTS_HEADER,
        "lists/LeaveListDialog.tsx · „Anuluj”",
        "lists/LeaveListDialog.tsx · „Zamknij”",
        "lists/LeaveListDialog.tsx · „Menu”",
        "lists/LeaveListDialog.tsx · „lub”",
        "lists/LeaveListDialog.tsx · „ok”",
      ].join("\n"),
    );
  });

  it("a shared .tsx file with only code attributes and code literals is not an error (T-109)", () => {
    const gaps = findCopyGaps({
      sources: {
        "components/Field.tsx": `
          const SELECTOR = "button:not(:disabled), a[href]";
          export const Field = ({ id, open }: { id: string; open: boolean }) => (
            <div role="group" className="field" id={\`\${id}-label\`} data-testid="field" aria-labelledby={\`\${id}-label\`} aria-describedby={open ? \`\${id}-hint\` : undefined}>
              <input type={open ? "text" : "password"} autoComplete="current-password" htmlFor="x" aria-invalid="true" aria-live="polite" />
              <Button variant="secondary" tone="error" />
              <Link to="/listy" state={{ from: "/listy" }} />
            </div>
          );`,
        "screens/SC-07-uczestnicy/messages.ts": `export const messages = {};`,
      },
      specs: { "SC-07-uczestnicy.md": spec() },
    });

    expect(gaps).toEqual([]);
  });

  it("a shared .ts module other than <name>Messages.ts with a displayed one-word text is an error (T-109)", () => {
    const check = () =>
      findCopyGaps({
        sources: {
          "lists/leaveList.ts": `export const m = { confirm: "Opuść", cancel: "Anuluj", close: "Zamknij" };`,
          "screens/SC-07-uczestnicy/messages.ts": `
            import { m } from "../../lists/leaveList";
            export const messages = { leave: m };`,
        },
        specs: { "SC-07-uczestnicy.md": spec() },
      });

    expect(check).toThrow(
      [
        SHARED_TEXTS_HEADER,
        "lists/leaveList.ts · „Opuść”",
        "lists/leaveList.ts · „Anuluj”",
        "lists/leaveList.ts · „Zamknij”",
      ].join("\n"),
    );
  });

  it("a constant of the same module in a template is expanded to its value (PRODUCT_NAME, T-109)", () => {
    const gaps = findCopyGaps({
      sources: {
        "components/productMessages.ts": `
          export const PRODUCT_NAME = "Wspólna lista zakupów";
          export function documentTitle(title: string): string {
            return \`\${title} · \${PRODUCT_NAME}\`;
          }`,
        "screens/SC-04-regulamin/messages.ts": `export const messages = { title: "Regulamin" };`,
        "screens/SC-04-regulamin/Terms.tsx": `
          import { documentTitle } from "../../components/productMessages";
          import { messages } from "./messages";
          export const Terms = () => <title>{documentTitle(messages.title)}</title>;`,
      },
      specs: { "SC-04-regulamin.md": spec(["title", "Regulamin"]) },
      designSystem:
        "## Copy\n\n| Key | Text |\n| --- | --- |\n| product.name | Wspólna lista zakupów |\n",
    });

    expect(gaps).toEqual([
      {
        screen: "SC-04",
        file: "components/productMessages.ts",
        text: "{…} · Wspólna lista zakupów",
      },
    ]);
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

describe("findUnusedCopyRows (fixtures, T-111)", () => {
  const sources = {
    "components/Dialog/dialogMessages.ts": `export const dialogMessages = { close: "Zamknij" };`,
    "screens/SC-07-uczestnicy/messages.ts": `
      export const messages = {
        title: "Uczestnicy",
        question: (name: string) => \`Opuścić listę „\${name}”?\`,
      };`,
    "screens/SC-07-uczestnicy/Members.tsx": `
      import { dialogMessages } from "../../components/Dialog/dialogMessages";
      import { messages } from "./messages";
      export const Members = () => <h1>{messages.title}{dialogMessages.close}</h1>;`,
  };

  it("a Copy row whose text the screen code does not show and without a source note is reported with screen and key", () => {
    const rows = findUnusedCopyRows({
      sources,
      specs: {
        "SC-07-uczestnicy.md": spec(
          ["title", "Uczestnicy"],
          ["close", "Zamknij"],
          ["leave.confirm.question", "Opuścić listę „{nazwa}”? (część `leave.confirm`; T-103)"],
          ["leave.confirm", "Opuścić listę „{nazwa}”? Żeby wrócić, potrzebujesz zaproszenia."],
          ["empty", "Nikt jeszcze nie dołączył. (z Layout/States, T-100)"],
        ),
      },
    });

    expect(rows).toEqual([
      {
        screen: "SC-07",
        key: "leave.confirm",
        text: "Opuścić listę „{…}”? Żeby wrócić, potrzebujesz zaproszenia.",
      },
      { screen: "SC-07", key: "empty", text: "Nikt jeszcze nie dołączył." },
    ]);
    expect(formatUnusedCopyRows(rows)).toContain("SC-07 · leave.confirm · „Opuścić listę");
  });

  it("a Copy row with a source note (mail, API, mobile, parts, other screen) is not reported", () => {
    const rows = findUnusedCopyRows({
      sources,
      specs: {
        "SC-07-uczestnicy.md": spec(
          ["title", "Uczestnicy"],
          ["leave.confirm", "Opuścić listę „{nazwa}”? Żeby wrócić… (złożony z części; T-111)"],
          ["mail.subject", "Reset hasła (mail z API; T-053)"],
          ["push", "Nowa pozycja (mobile; T-200)"],
          ["joined", "Dołączyłeś(-aś) do listy „{nazwa}”. (pokazuje SC-06; T-111)"],
          ["a / b", "Pierwszy / Drugi (pokazuje SC-01; T-111)"],
        ),
      },
    });

    expect(rows).toEqual([]);
  });

  it("a note without a source marker does not excuse a row; `a / b` rows are checked per text", () => {
    const rows = findUnusedCopyRows({
      sources,
      specs: {
        "SC-07-uczestnicy.md": spec(
          ["title / back", "Uczestnicy / Wstecz (z Layout/States, T-100)"],
          ["mailbox", "Skrzynka mailowa (pole e-mail; mobile później, T-100)"],
        ),
      },
    });

    expect(rows).toEqual([
      { screen: "SC-07", key: "back", text: "Wstecz" },
      { screen: "SC-07", key: "mailbox", text: "Skrzynka mailowa" },
    ]);
  });
});
