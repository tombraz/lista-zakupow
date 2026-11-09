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

/** Plik komunikatów: `messages.ts` ekranu albo `<nazwa>Messages.ts` modułu wspólnego (T-103). */
const MESSAGES_FILE = /(^|\/)messages\.ts$|[a-z]Messages\.ts$/;

const COPY_HEADING = /^## Copy\s*$/m;

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
  const misplaced = modules.sharedTsxTexts();
  if (misplaced.length > 0) {
    throw new Error(
      [
        "Teksty interfejsu w plikach .tsx modułów wspólnych (miejsce: plik .ts modułu, np. lists/listName.ts):",
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
   * Pliki `.tsx` modułów wspólnych (poza `screens/`, także `components/`, bez testów) tylko
   * renderują teksty importowane z plików `.ts`: literał, który wygląda na tekst interfejsu, oraz
   * każdy tekst JSX i literał atrybutu tekstowego (`TEXT_ATTRIBUTES`) z literą są tam błędem (T-103,
   * T-106, T-107). Inaczej test nie widzi tekstu, bo literały `.tsx` są poza rejestrem. Tekst JSX i
   * atrybut tekstowy trafiają do użytkownika albo czytnika ekranu, więc nie muszą wyglądać na polski
   * tekst (`<span>Zamknij</span>`, `aria-label="Zamknij"`); inny literał bywa klasą albo typem
   * (`className`, `role`), więc musi.
   */
  sharedTsxTexts(): { file: string; text: string }[] {
    const found: { file: string; text: string }[] = [];
    for (const file of Object.keys(this.sources).sort()) {
      if (!file.endsWith(".tsx") || file.startsWith("screens/") || file.endsWith(".test.tsx")) {
        continue;
      }
      const module = this.module(file);
      const jsxTexts: string[] = [];
      const visit = (node: ts.Node): void => {
        if (ts.isJsxText(node)) jsxTexts.push(node.text.trim().replace(/\s+/g, " "));
        const attribute = textAttributeValue(node);
        if (attribute !== null) jsxTexts.push(attribute);
        ts.forEachChild(node, visit);
      };
      visit(module.source);
      const texts = [
        ...this.literals(module, [module.source]).filter(looksLikeText),
        ...jsxTexts.filter((text) => /\p{L}/u.test(text)),
      ];
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
   * `messages.ts` i `<nazwa>Messages.ts`: każdy literał. Inny plik `.ts` miesza teksty z logiką (klucze pól, adresy),
   * więc liczą się literały, które wyglądają na tekst interfejsu. JSX i literały w plikach `.tsx`
   * są poza zakresem (T-100): `.tsx` tylko prowadzi importy.
   */
  private texts(file: string, nodes: ts.Node[]): string[] {
    if (file.endsWith(".tsx")) return [];
    const literals = this.literals(this.module(file), nodes);
    return MESSAGES_FILE.test(file) ? literals : literals.filter(looksLikeText);
  }

  private literals(module: Module, nodes: ts.Node[]): string[] {
    const texts: string[] = [];
    const constant = (expression: ts.Expression) =>
      constantOf(expression, module.imports, this.packages);
    const visit = (node: ts.Node): void => {
      const text = literalText(node, constant);
      if (text !== null && !isNotText(node, text)) texts.push(text);
      ts.forEachChild(node, visit);
    };
    nodes.forEach(visit);
    return texts;
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

/** Atrybuty JSX, które trafiają do użytkownika albo do czytnika ekranu (T-107). */
const TEXT_ATTRIBUTES = new Set(["aria-label", "aria-description", "title", "alt", "placeholder"]);

/** Literał w atrybucie tekstowym (`aria-label="…"`, `alt={"…"}`) → jego treść; inaczej `null`. */
function textAttributeValue(node: ts.Node): string | null {
  if (!ts.isJsxAttribute(node) || !TEXT_ATTRIBUTES.has(node.name.getText())) return null;
  const value = node.initializer;
  const literal = value && ts.isJsxExpression(value) ? value.expression : value;
  if (!literal || !(ts.isStringLiteral(literal) || ts.isNoSubstitutionTemplateLiteral(literal))) {
    return null;
  }
  return literal.text;
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

function copyTexts(markdown: string): Set<string> {
  const texts = new Set<string>();
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => /^## Copy\s*$/.test(line));
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("## ")) break;
    const [key, cell] = tableCells(line);
    if (key === undefined || cell === undefined) continue;
    // `a / b` w kluczu: komórka ma tyle samo tekstów rozdzielonych „ / ”.
    const text = cell.replace(NOTE, "");
    const split = key.includes(" / ") ? text.split(" / ") : [text];
    for (const part of split) texts.add(part.replace(/\{[^{}]+\}/g, PARAMETER));
  }
  return texts;
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
