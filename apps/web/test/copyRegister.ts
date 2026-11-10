import ts from "typescript";

export interface CopyGap {
  screen: string;
  file: string;
  text: string;
}

export interface CopyRegisterInput {
  /** Pliki `apps/web/src`: ścieżka względna (z `/`) → treść. */
  sources: Record<string, string>;
  /** Specyfikacje ekranów: nazwa pliku (`SC-01-logowanie.md`) → treść. */
  specs: Record<string, string>;
  /** Wartości stałych z pakietów (`@lista/shared` → moduł). */
  packages?: Record<string, Record<string, unknown>>;
  /** `docs/design/design-system.md`: tabela „## Copy” komponentów design systemu (T-106). */
  designSystem?: string;
}

type Packages = Record<string, Record<string, unknown>>;

/** Wiązanie importu: plik w `sources` (import względny) albo pakiet. */
interface Binding {
  from: string;
  name: string;
  relative: boolean;
}

interface Module {
  file: string;
  source: ts.SourceFile;
  imports: Map<string, Binding>;
  declarations: Map<string, ts.Node[]>;
}

const SCREEN_DIR = /^screens\/(SC-\d{2})-[^/]+\//;

/**
 * Plik komunikatów: `messages.ts` ekranu albo `<nazwa>Messages.ts` modułu wspólnego (T-103). Moduł
 * wspólny ma teksty interfejsu tylko w `<nazwa>Messages.ts` (T-109).
 */
const MESSAGES_FILE = /(^|\/)messages\.ts$|[a-z]Messages\.ts$/;

const COPY_HEADING = /^## Copy\s*$/m;

/**
 * Dopisek źródła wiersza Copy, którego tekstu nie pokazuje kod web ekranu (T-111), jako osobny
 * segment dopisku (na początku albo po `; ` / `, `): `mail z API` (tekst maila tworzony przez API;
 * sprawdza go `apps/api/test/reset-mail.copy.test.ts`, T-115) albo `mobile` (tekst aplikacji
 * mobilnej). „e-mail” w innym dopisku nie jest źródłem.
 */
const COPY_SOURCE = /(?:^\(|[;,] )(?:mail z API|mobile)(?=[;,)])/;

/**
 * Dopisek `złożony z części` (kod składa tekst z wierszy-części) jako osobny segment dopisku:
 * wiersz przechodzi tylko, gdy Copy ekranu ma wiersze „(część `<klucz>`…)”, tekst wiersza zawiera
 * tekst każdej części, a kod ekranu pokazuje co najmniej jedną część (T-115). Część, której kod nie
 * pokazuje, jest zgłaszana jak każdy wiersz.
 */
const COMPOSED = /(?:^\(|[;,] )złożony z części(?=[;,)])/;

/** Dopisek „część `a`” albo „część `a`, `b`” (część wierszy złożonych `a` i `b`) jako segment. */
const PART_OF = /(?:^\(|; )część ((?:`[^`]+`(?:, )?)+)(?=[;)])/;

/**
 * Dopisek `pokazuje SC-xx` (tekst pokazuje inny ekran) jako osobny segment dopisku: wiersz
 * przechodzi tylko, gdy tekst jest w tekstach ekranu SC-xx, tych samych, które liczy test Copy
 * dla SC-xx (T-113).
 */
const SHOWN_ON = /(?:^\(|[;,] )pokazuje (SC-\d{2})(?=[;,)])/;

/** Parametr tekstu: `${…}` w kodzie i `{nazwa}` w Copy. */
const PARAMETER = "{…}";

export function findCopyGaps({
  sources,
  specs,
  packages = {},
  designSystem = "## Copy\n",
}: CopyRegisterInput): CopyGap[] {
  if (!COPY_HEADING.test(designSystem)) throw new Error("design-system.md: brak sekcji „## Copy”");
  const componentCopy = copyTexts(designSystem);
  const modules = new ModuleGraph(sources, packages);
  const misplaced = modules.misplacedSharedTexts();
  if (misplaced.length > 0) {
    throw new Error(
      [
        "Teksty interfejsu w modułach wspólnych poza plikiem <nazwa>Messages.ts (przenieś tekst do <nazwa>Messages.ts modułu, np. lists/leaveMessages.ts):",
        ...misplaced.map(({ file, text }) => `${file} · „${text}”`),
      ].join("\n"),
    );
  }
  const gaps: CopyGap[] = [];
  const repeated: CopyGap[] = [];
  for (const [screen, files] of screens(sources)) {
    const copy = copyTexts(specOf(screen, specs));
    const texts = modules.screenTexts(files);
    const ownTexts = new Set(
      texts.filter(({ file }) => !file.startsWith("components/")).map(({ text }) => text),
    );
    for (const { file, text } of texts) {
      const component = file.startsWith("components/") && componentCopy.has(text);
      if (!copy.has(text) && !component) gaps.push({ screen, file, text });
      // Ekran nie powtarza wierszy Copy komponentów (design-system.md, „## Copy”; T-108).
      if (component && copy.has(text) && !ownTexts.has(text)) repeated.push({ screen, file, text });
    }
  }
  if (repeated.length > 0) {
    throw new Error(
      [
        "Wiersze Copy ekranu powtarzają tabelę „## Copy” komponentów w design-system.md (ekran nie powtarza wierszy komponentów; usuń wiersz z Copy ekranu):",
        ...repeated.map(({ screen, file, text }) => `${screen} · ${file} · „${text}”`),
      ].join("\n"),
    );
  }
  return gaps;
}

export function formatCopyGaps(gaps: CopyGap[]): string {
  return [
    "Teksty bez wiersza w tabeli Copy specyfikacji ekranu (docs/design/screens):",
    ...gaps.map(({ screen, file, text }) => `${screen} · ${file} · „${text}”`),
  ].join("\n");
}

export interface UnusedCopyRow {
  screen: string;
  key: string;
  text: string;
  /** Ekran z dopisku `pokazuje SC-xx`, który nie pokazuje tekstu wiersza (T-113). */
  shownOn?: string;
  /** Ekranu z dopisku `pokazuje SC-xx` nie ma w kodzie web (T-113). */
  missingScreen?: true;
  /**
   * Dlaczego wiersz `złożony z części` nie przechodzi (T-115): brak wierszy-części (`noParts`), tekst
   * nie zawiera tekstu części `part` (`partMissing`), kod ekranu nie pokazuje żadnej części
   * (`partsNotShown`).
   */
  composed?: "noParts" | "partMissing" | "partsNotShown";
  /** Część, której tekstu nie zawiera wiersz złożony (`composed: "partMissing"`). */
  part?: string;
}

/**
 * Wiersze Copy ekranu, których tekstu nie pokazuje kod web ekranu (z modułami wspólnymi i
 * komponentami, które ekran importuje) i które nie mają dopisku źródła (`COPY_SOURCE`, T-111).
 * Wiersz z dopiskiem `pokazuje SC-xx` przechodzi tylko, gdy tekst jest w tekstach ekranu SC-xx
 * (`SHOWN_ON`, T-113). Wiersz z dopiskiem `złożony z części` przechodzi tylko z wierszami-częściami
 * (`COMPOSED`, `composedProblem`, T-115).
 */
export function findUnusedCopyRows({
  sources,
  specs,
  packages = {},
}: CopyRegisterInput): UnusedCopyRow[] {
  const modules = new ModuleGraph(sources, packages);
  const textsOf = new Map<string, Set<string>>();
  for (const [screen, files] of screens(sources)) {
    textsOf.set(screen, new Set(modules.screenTexts(files).map(({ text }) => text)));
  }
  const unused: UnusedCopyRow[] = [];
  for (const [screen, used] of textsOf) {
    const rows = copyRows(specOf(screen, specs));
    for (const { key, text, note } of rows) {
      if (used.has(text) || COPY_SOURCE.test(note)) continue;
      if (COMPOSED.test(note)) {
        const problem = composedProblem(key, text, rows, used);
        if (problem) unused.push({ screen, key, text, ...problem });
        continue;
      }
      const shownOn = SHOWN_ON.exec(note)?.[1];
      const shownTexts = shownOn === undefined ? undefined : textsOf.get(shownOn);
      if (shownOn === undefined) unused.push({ screen, key, text });
      else if (shownTexts === undefined)
        unused.push({ screen, key, text, shownOn, missingScreen: true });
      else if (!shownTexts.has(text)) unused.push({ screen, key, text, shownOn });
    }
  }
  return unused;
}

/** Wiersze-części wiersza złożonego `key`: dopisek „(część `key`…)” (`PART_OF`). */
function partsOf(key: string, rows: CopyRow[]): CopyRow[] {
  return rows.filter(({ note }) => {
    const keys = PART_OF.exec(note)?.[1] ?? "";
    return [...keys.matchAll(/`([^`]+)`/g)].some(([, part]) => part === key);
  });
}

function composedProblem(
  key: string,
  text: string,
  rows: CopyRow[],
  used: Set<string>,
): Pick<UnusedCopyRow, "composed" | "part"> | null {
  const parts = partsOf(key, rows);
  if (parts.length === 0) return { composed: "noParts" };
  const missing = parts.find((part) => !text.includes(part.text));
  if (missing) return { composed: "partMissing", part: missing.key };
  if (!parts.some((part) => used.has(part.text))) return { composed: "partsNotShown" };
  return null;
}

export function formatUnusedCopyRows(rows: UnusedCopyRow[]): string {
  return [
    "Wiersze Copy ekranu bez tekstu w kodzie web ekranu i bez dopisku źródła (usuń martwy wiersz albo dopisz źródło: „(mail z API; T-053)”, „(mobile; T-…)”, „(złożony z części; T-111)”, „(pokazuje SC-01; T-111)”; dopisek „pokazuje SC-xx” wymaga tekstu w kodzie ekranu SC-xx, T-113; „złożony z części” wymaga wierszy „(część `<klucz>`…)”, których tekst zawiera i z których kod ekranu pokazuje co najmniej jeden, T-115):",
    ...rows.map(({ screen, key, text, shownOn, missingScreen, composed, part }) => {
      const row = `${screen} · ${key} · „${text}”`;
      if (composed === "noParts")
        return `${row} (złożony z części: brak wiersza „(część \`${key}\`…)” w Copy ${screen})`;
      if (composed === "partMissing")
        return `${row} (złożony z części: tekst nie zawiera części \`${part ?? ""}\`)`;
      if (composed === "partsNotShown")
        return `${row} (złożony z części: kod ${screen} nie pokazuje żadnej części)`;
      if (shownOn === undefined) return row;
      const reason = missingScreen
        ? `brak ekranu ${shownOn}`
        : `${shownOn} nie pokazuje tego tekstu`;
      return `${row} (pokazuje ${shownOn}: ${reason})`;
    }),
  ].join("\n");
}

/** Ekran (`SC-01`) → pliki źródłowe jego katalogu (bez testów), w kolejności ekranów. */
function screens(sources: Record<string, string>): Map<string, string[]> {
  const byScreen = new Map<string, string[]>();
  for (const file of Object.keys(sources).sort()) {
    const screen = SCREEN_DIR.exec(file)?.[1];
    if (!screen || /\.test\.tsx?$/.test(file)) continue;
    byScreen.set(screen, [...(byScreen.get(screen) ?? []), file]);
  }
  return byScreen;
}

function specOf(screen: string, specs: Record<string, string>): string {
  const name = Object.keys(specs).find((file) => file.startsWith(`${screen}-`));
  if (name === undefined)
    throw new Error(`${screen}: brak specyfikacji ekranu w docs/design/screens`);
  const markdown = specs[name] ?? "";
  if (!COPY_HEADING.test(markdown)) throw new Error(`${name}: brak sekcji „## Copy”`);
  return markdown;
}

class ModuleGraph {
  private readonly parsed = new Map<string, Module>();

  constructor(
    private readonly sources: Record<string, string>,
    private readonly packages: Packages,
  ) {}

  /**
   * Teksty ekranu: z plików jego katalogu oraz z deklaracji, które te pliki importują z modułów
   * wspólnych, także pośrednio.
   */
  screenTexts(files: string[]): { file: string; text: string }[] {
    const found = new Map<string, { file: string; text: string }>();
    const add = (file: string, nodes: ts.Node[]) => {
      for (const text of this.texts(file, nodes)) found.set(`${file}\0${text}`, { file, text });
    };
    const queue: [string, string][] = [];
    for (const file of files) {
      const module = this.module(file);
      add(file, [module.source]);
      for (const binding of module.imports.values()) {
        if (binding.relative && !files.includes(binding.from))
          queue.push([binding.from, binding.name]);
      }
    }
    const seen = new Set<string>();
    for (let next = queue.shift(); next; next = queue.shift()) {
      const [file, name] = next;
      if (seen.has(`${file}#${name}`)) continue;
      seen.add(`${file}#${name}`);
      const module = this.module(file);
      const nodes = this.declarationOf(module, name, queue);
      add(file, nodes);
      for (const node of nodes) queue.push(...this.references(module, node));
    }
    return [...found.values()];
  }

  /**
   * Moduł wspólny (wszystko poza `screens/`, także `components/`, bez testów) ma teksty interfejsu
   * tylko w `<nazwa>Messages.ts`; wyświetlany literał w innym jego pliku `.ts` albo `.tsx` to błąd
   * (T-109). Inaczej siła kontroli zależałaby od położenia tekstu: inny plik miesza teksty z logiką,
   * więc test brałby z niego tylko literały, które wyglądają na tekst, a jednowyrazowe „Anuluj”
   * przechodziłoby po cichu.
   * - W JSX (tekst, wyrażenie `{…}` w treści, atrybut i props komponentu) wyświetlany jest każdy
   *   literał z literą (`<span>{"Zamknij"}</span>`, `label="Zamknij"`), poza atrybutami kodu
   *   (`isCodeAttribute`: `className`, `type`, `role`, `id`, `data-*`, `aria-*by`, `to` itd.).
   * - Poza JSX literał jest tekstem, jeśli nie jest kodem (`isCode`), np. `{ cancel: "Anuluj" }`.
   * - Nie są tekstem literały w miejscach z `isNotText` (klucze, typy, porównania, `new …(…)`).
   */
  misplacedSharedTexts(): { file: string; text: string }[] {
    const found: { file: string; text: string }[] = [];
    for (const file of Object.keys(this.sources).sort()) {
      if (!isSharedCodeFile(file)) continue;
      const module = this.module(file);
      const constant = this.constant(module);
      const texts: string[] = [];
      const visit = (node: ts.Node, inJsx: boolean): void => {
        if (ts.isJsxAttribute(node)) {
          if (!isCodeAttribute(node.name.getText())) {
            ts.forEachChild(node, (child) => {
              visit(child, true);
            });
          }
          return;
        }
        if (ts.isJsxText(node)) {
          const text = node.text.trim().replace(/\s+/g, " ");
          if (/\p{L}/u.test(text)) texts.push(text);
        }
        const text = literalText(node, constant);
        if (text !== null && !isNotText(node, text) && (inJsx || !isCode(text))) texts.push(text);
        // Wyświetla się wyrażenie w treści JSX; argument wywołania w nim to dane wejściowe, nie tekst
        // (`toLocaleUpperCase("pl-PL")`), więc liczy się jak literał poza JSX.
        const jsxChildren = ts.isJsxElement(node) || ts.isJsxFragment(node);
        const call = ts.isCallExpression(node) || ts.isNewExpression(node);
        ts.forEachChild(node, (child) => {
          const argument = call && node.arguments?.includes(child as ts.Expression) === true;
          visit(child, !argument && (inJsx || (jsxChildren && ts.isJsxExpression(child))));
        });
      };
      visit(module.source, false);
      for (const text of new Set(texts)) found.push({ file, text });
    }
    return found;
  }

  private module(file: string): Module {
    const cached = this.parsed.get(file);
    if (cached) return cached;
    const code = this.sources[file];
    if (code === undefined) throw new Error(`${file}: brak pliku`);
    const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, kind);
    const module: Module = {
      file,
      source,
      imports: this.importsOf(file, source),
      declarations: declarationsOf(source),
    };
    this.parsed.set(file, module);
    return module;
  }

  /** Deklaracja nazwy w module; nazwa tylko importowana i eksportowana dalej → kolejka. */
  private declarationOf(module: Module, name: string, queue: [string, string][]): ts.Node[] {
    const nodes = module.declarations.get(name);
    if (nodes) return nodes;
    const binding = module.imports.get(name);
    if (binding?.relative) queue.push([binding.from, binding.name]);
    else if (!binding) throw new Error(`${module.file}: nie rozpoznano eksportu „${name}”`);
    return [];
  }

  /** Nazwy z modułu i z importów względnych, których używa deklaracja. */
  private references(module: Module, node: ts.Node): [string, string][] {
    const found: [string, string][] = [];
    const visit = (child: ts.Node): void => {
      if (ts.isIdentifier(child)) {
        const binding = module.imports.get(child.text);
        if (module.declarations.has(child.text)) found.push([module.file, child.text]);
        else if (binding?.relative) found.push([binding.from, binding.name]);
      }
      ts.forEachChild(child, visit);
    };
    ts.forEachChild(node, visit);
    return found;
  }

  /**
   * Teksty deklaracji: z `messages.ts` i `<nazwa>Messages.ts` każdy literał. Inny plik `.ts` modułu
   * wspólnego nie ma tekstów (`misplacedSharedTexts`, T-109). Inny plik `.ts` katalogu ekranu miesza
   * teksty z logiką (klucze pól, adresy), więc liczą się literały, które wyglądają na tekst
   * interfejsu. Pliki `.tsx` tylko prowadzą importy (T-100).
   */
  private texts(file: string, nodes: ts.Node[]): string[] {
    if (file.endsWith(".tsx")) return [];
    const literals = this.literals(this.module(file), nodes);
    return MESSAGES_FILE.test(file) ? literals : literals.filter(looksLikeText);
  }

  private literals(module: Module, nodes: ts.Node[]): string[] {
    const texts: string[] = [];
    const constant = this.constant(module);
    const visit = (node: ts.Node): void => {
      const text = literalText(node, constant);
      if (text !== null && !isNotText(node, text)) texts.push(text);
      ts.forEachChild(node, visit);
    };
    nodes.forEach(visit);
    return texts;
  }

  /** Wartość stałej w szablonie: z pakietu albo literał stałej tego samego modułu (`PRODUCT_NAME`). */
  private constant(module: Module): (expression: ts.Expression) => string | null {
    return (expression) =>
      constantOf(expression, module.imports, this.packages) ?? localConstant(module, expression);
  }

  /** Importy wartości (bez `import type`): nazwa lokalna → wiązanie. */
  private importsOf(file: string, source: ts.SourceFile): Map<string, Binding> {
    const imports = new Map<string, Binding>();
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
        continue;
      }
      const specifier = statement.moduleSpecifier.text;
      const clause = statement.importClause;
      const typeOnly = clause?.phaseModifier === ts.SyntaxKind.TypeKeyword;
      // Style i obrazy nie mają tekstów.
      if (!clause || typeOnly || /\.(css|svg|png)$/.test(specifier)) continue;
      const relative = specifier.startsWith(".");
      const from = relative ? this.resolve(file, specifier) : specifier;
      const bindings = clause.namedBindings;
      if (clause.name || (bindings && !ts.isNamedImports(bindings))) {
        if (relative) throw new Error(`${file}: nieobsługiwany import z „${specifier}”`);
        continue;
      }
      for (const element of bindings?.elements ?? []) {
        if (element.isTypeOnly) continue;
        const name = (element.propertyName ?? element.name).text;
        imports.set(element.name.text, { from, name, relative });
      }
    }
    return imports;
  }

  private resolve(file: string, specifier: string): string {
    const base = joinPath(file, specifier);
    const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`];
    const found = candidates.find((candidate) => candidate in this.sources);
    if (found === undefined) throw new Error(`${file}: nie rozpoznano importu „${specifier}”`);
    return found;
  }
}

/** Ścieżka importu względnego wobec pliku (`screens/SC-01/x.ts` + `../../errorText`). */
function joinPath(file: string, specifier: string): string {
  const parts = file.split("/").slice(0, -1);
  for (const part of specifier.split("/")) {
    if (part === "..") parts.pop();
    else if (part !== ".") parts.push(part);
  }
  return parts.join("/");
}

/** Deklaracje najwyższego poziomu: nazwa → węzły (funkcja, stała, klasa). */
function declarationsOf(source: ts.SourceFile): Map<string, ts.Node[]> {
  const declarations = new Map<string, ts.Node[]>();
  const add = (name: string, node: ts.Node) =>
    declarations.set(name, [...(declarations.get(name) ?? []), node]);
  for (const statement of source.statements) {
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) add(declaration.name.text, declaration);
      }
    } else if (
      (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) &&
      statement.name
    ) {
      add(statement.name.text, statement);
    }
  }
  return declarations;
}

/** Plik kodu modułu wspólnego spoza `<nazwa>Messages.ts`: poza `screens/`, bez testów (T-109). */
function isSharedCodeFile(file: string): boolean {
  return (
    /\.tsx?$/.test(file) &&
    !file.startsWith("screens/") &&
    !/\.test\.tsx?$|\.d\.ts$/.test(file) &&
    !MESSAGES_FILE.test(file)
  );
}

/**
 * Atrybuty JSX, które nie trafiają do użytkownika ani do czytnika ekranu: klasy, typy, role,
 * identyfikatory, adresy, warianty komponentów, `data-*`, zdarzenia `on…` i `aria-*` poza
 * tekstowymi (`TEXT_ARIA`). Każdy inny atrybut, także props własnego komponentu (`label`), jest
 * tekstem (T-107, T-109).
 */
const CODE_ATTRIBUTES = new Set([
  "className",
  "type",
  "role",
  "id",
  "key",
  "href",
  "to",
  "state",
  "replace",
  "target",
  "rel",
  "src",
  "variant",
  "tone",
  "size",
  "autoComplete",
  "inputMode",
  "enterKeyHint",
  "name",
  "htmlFor",
  "method",
  "style",
  "tabIndex",
  "lang",
  "dir",
]);

/** `aria-*`, które są tekstem dla czytnika ekranu (T-107). */
const TEXT_ARIA = new Set([
  "aria-label",
  "aria-description",
  "aria-roledescription",
  "aria-valuetext",
  "aria-placeholder",
]);

function isCodeAttribute(name: string): boolean {
  if (name.startsWith("aria-")) return !TEXT_ARIA.has(name);
  return CODE_ATTRIBUTES.has(name) || name.startsWith("data-") || /^on[A-Z]/.test(name);
}

/**
 * Kod, nie tekst (poza JSX modułu wspólnego, T-109): bez polskiej litery, bez dwóch słów
 * rozdzielonych spacją i bez słowa, które zaczyna się wielką literą (`name`, `listId`, `POST`, `same-origin`,
 * `/api/v1/lists`, `pl-PL`, `(prefers-reduced-motion: reduce)`). „Anuluj” i „do kupienia” to tekst.
 */
function isCode(text: string): boolean {
  return (
    !/[ąćęłńóśźż]/i.test(text) &&
    !/\p{L}\s+\p{L}/u.test(text) &&
    !/(^|\P{L})\p{Lu}\p{Ll}/u.test(text)
  );
}

/** Tekst interfejsu po polsku: polska litera albo słowo z wielkiej litery i kolejne słowo. */
function looksLikeText(text: string): boolean {
  return /[ąćęłńóśźż]/i.test(text) || /\p{Lu}\p{Ll}*\s+\p{L}/u.test(text);
}

/** Treść literału; w szablonie stała z pakietu jako wartość, inne wyrażenie jako parametr. */
function literalText(node: ts.Node, constant: (e: ts.Expression) => string | null): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (!ts.isTemplateExpression(node)) return null;
  return node.templateSpans.reduce(
    (text, span) => text + (constant(span.expression) ?? PARAMETER) + span.literal.text,
    node.head.text,
  );
}

/** `X`, `X.a.b` albo `String(…)` z nich, gdy `X` to stała z pakietu → jej wartość. */
function constantOf(
  expression: ts.Expression,
  imports: Map<string, Binding>,
  packages: Packages,
): string | null {
  if (ts.isCallExpression(expression) && expression.arguments.length === 1) {
    const [argument] = expression.arguments;
    const isString =
      ts.isIdentifier(expression.expression) && expression.expression.text === "String";
    return isString && argument ? constantOf(argument, imports, packages) : null;
  }
  const path: string[] = [];
  let node: ts.Expression = expression;
  while (ts.isPropertyAccessExpression(node)) {
    path.unshift(node.name.text);
    node = node.expression;
  }
  const imported = ts.isIdentifier(node) ? imports.get(node.text) : undefined;
  if (!imported || imported.relative) return null;
  const value = [imported.name, ...path].reduce<unknown>(
    (object, key) => (object as Record<string, unknown> | undefined)?.[key],
    packages[imported.from],
  );
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

/** Stała tego samego modułu z literałem (`const PRODUCT_NAME = "…"`) → jej wartość. */
function localConstant(module: Module, expression: ts.Expression): string | null {
  if (!ts.isIdentifier(expression)) return null;
  const [declaration, ...rest] = module.declarations.get(expression.text) ?? [];
  if (!declaration || rest.length > 0 || !ts.isVariableDeclaration(declaration)) return null;
  const constant = (declaration.parent.flags & ts.NodeFlags.Const) !== 0;
  const value = declaration.initializer;
  if (!constant || !value) return null;
  return ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value) ? value.text : null;
}

const COMPARISONS = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
]);

/** Literał bez litery (pusty, separator) albo w miejscu, które nie trafia na ekran. */
function isNotText(node: ts.Node, text: string): boolean {
  if (!/\p{L}/u.test(text) || isConstructorArgument(node)) return true;
  const parent = node.parent;
  if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) return true;
  if (ts.isLiteralTypeNode(parent)) return true;
  if (ts.isPropertyAssignment(parent) && parent.name === node) return true;
  if (ts.isElementAccessExpression(parent) && parent.argumentExpression === node) return true;
  if (ts.isBinaryExpression(parent)) return COMPARISONS.has(parent.operatorToken.kind);
  return ts.isCaseClause(parent);
}

/**
 * Argument `new …(…)`, także wewnątrz obiektu opcji: konfiguracja (`new Intl.DateTimeFormat("pl-PL",
 * { month: "long" })`), nie tekst (decyzja właściciela 2026-11-05, T-100).
 */
function isConstructorArgument(node: ts.Node): boolean {
  for (let child = node; !ts.isSourceFile(child); child = child.parent) {
    const parent = child.parent;
    if (ts.isNewExpression(parent) && parent.arguments?.includes(child as ts.Expression)) {
      return true;
    }
  }
  return false;
}

/** Dopisek na końcu komórki: nawias po spacji z `:`, `;` albo ID zadania (`T-100`). */
const NOTE = / \((?=[^()]*(?:[:;]|T-\d{3}))[^()]*\)$/;

interface CopyRow {
  key: string;
  text: string;
  /** Dopisek na końcu komórki (`NOTE`) albo pusty. */
  note: string;
}

function copyTexts(markdown: string): Set<string> {
  return new Set(copyRows(markdown).map(({ text }) => text));
}

/** Wiersze tabeli „## Copy” bez nagłówka: jeden na tekst (klucz `a / b` daje dwa). */
function copyRows(markdown: string): CopyRow[] {
  const rows: CopyRow[] = [];
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => /^## Copy\s*$/.test(line));
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("## ")) break;
    const [key, cell] = tableCells(line);
    if (key === undefined || cell === undefined || key === "Key" || /^-+$/.test(key)) continue;
    const note = NOTE.exec(cell)?.[0].trim() ?? "";
    // `a / b` w kluczu: komórka ma tyle samo tekstów rozdzielonych „ / ”.
    const text = cell.replace(NOTE, "");
    const keys = key.split(" / ");
    const parts = keys.length > 1 ? text.split(" / ") : [text];
    parts.forEach((part, index) => {
      const partKey = keys[index] ?? key;
      rows.push({ key: partKey, text: part.replace(/\{[^{}]+\}/g, PARAMETER), note });
    });
  }
  return rows;
}

/** Komórki wiersza tabeli Markdown (`\|` to znak w treści, nie granica komórki). */
function tableCells(line: string): string[] {
  if (!line.startsWith("|")) return [];
  return line
    .slice(1)
    .split(/(?<!\\)\|/)
    .slice(0, -1)
    .map((cell) => cell.trim().replace(/\\\|/g, "|"));
}
