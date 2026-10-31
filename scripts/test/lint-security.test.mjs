// Fixtures reguł bezpieczeństwa lintu (T-050; TH-15, TH-16, TH-20): każde naruszenie pada z właściwą
// regułą i komunikatem z identyfikatorem zagrożenia, bezpieczny odpowiednik przechodzi. Konfiguracja
// to eslint.config.js repozytorium. Treść idzie przez lintText pod nazwą istniejącego pliku (typed
// linting zna tylko pliki z tsconfig), więc w drzewie nie powstają pliki; jedna instancja ESLint
// buduje program TypeScript raz.
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";

const root = fileURLToPath(new URL("../..", import.meta.url));
const eslint = new ESLint({ cwd: root });

const web = "apps/web/src/components/AddBar/AddBar.tsx";
const mobile = "apps/mobile/src/screens/start/StartScreen.tsx";
const api = "apps/api/src/modules/listy/infra/lists-repository.ts";
const schema = "apps/api/src/db/schema.ts";
const shared = "packages/shared/src/api/account.ts";

const SECURITY_RULES = [
  "no-restricted-syntax",
  "no-restricted-globals",
  "no-restricted-properties",
];
const syntax = "no-restricted-syntax";
const html =
  "export const A = ({ html }: { html: string }) => <div dangerouslySetInnerHTML={{ __html: html }} />;";
const show = (body) => `export function show(el: HTMLElement, name: string) { ${body} }`;

const rejected = [
  ["dangerouslySetInnerHTML", web, syntax, "TH-15", html],
  ["dangerouslySetInnerHTML", mobile, syntax, "TH-15", html],
  ["przypisanie innerHTML", web, syntax, "TH-15", show("el.innerHTML = name;")],
  ["przypisanie innerHTML przez indeks", web, syntax, "TH-15", show('el["innerHTML"] += name;')],
  ["przypisanie outerHTML", web, syntax, "TH-15", show("el.outerHTML = name;")],
  ["insertAdjacentHTML", web, syntax, "TH-15", show('el.insertAdjacentHTML("beforeend", name);')],
  [
    "insertAdjacentHTML",
    shared,
    syntax,
    "TH-15",
    'export function show(el: { insertAdjacentHTML(a: string, b: string): void }, name: string) { el.insertAdjacentHTML("beforeend", name); }',
  ],
  [
    "sql.raw z danymi",
    api,
    syntax,
    "TH-20",
    'import { sql } from "drizzle-orm";\nexport const byName = (name: string) => sql.raw(`name = ${name}`);',
  ],
  [
    "sql.raw z danymi w schema.ts",
    schema,
    syntax,
    "TH-20",
    'import { sql } from "drizzle-orm";\nexport const byName = (name: string) => sql.raw(name);',
  ],
  ["localStorage", web, "no-restricted-globals", "TH-16", show('localStorage.setItem("x", name);')],
  [
    "sessionStorage",
    web,
    "no-restricted-globals",
    "TH-16",
    show('sessionStorage.setItem("x", name);'),
  ],
  [
    "window.localStorage",
    web,
    "no-restricted-properties",
    "TH-16",
    show('window.localStorage.setItem("x", name);'),
  ],
  [
    "sesja w AsyncStorage",
    mobile,
    syntax,
    "TH-16",
    'declare const AsyncStorage: { setItem(key: string, value: string): Promise<void> };\nexport const save = (token: string) => AsyncStorage.setItem("session-token", token);',
  ],
];

const accepted = [
  [
    "textContent i insertAdjacentText",
    web,
    show('el.textContent = name; el.insertAdjacentText("beforeend", name);'),
  ],
  ["odczyt innerHTML", web, "export const size = (el: HTMLElement) => el.innerHTML.length;"],
];

async function errors(file, source) {
  const [result] = await eslint.lintText(`${source}\n`, { filePath: file });
  return (result?.messages ?? []).filter((message) => message.severity === 2);
}

let failures = 0;
function check(name, ok, details) {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}`);
  if (!ok) {
    console.log(`     ${details}`);
    failures += 1;
  }
}

for (const [name, file, rule, threat, source] of rejected) {
  const found = await errors(file, source);
  const hit = found.some((m) => m.ruleId === rule && m.message.includes(threat));
  check(`${name} (${file})`, hit, `brak błędu ${rule} z ${threat}; są: ${JSON.stringify(found)}`);
}
for (const [name, file, source] of accepted) {
  const found = (await errors(file, source)).filter((m) => SECURITY_RULES.includes(m.ruleId));
  check(`${name} (${file})`, found.length === 0, `nieoczekiwane: ${JSON.stringify(found)}`);
}

process.exit(failures);
