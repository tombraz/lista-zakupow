import eslintComments from "@eslint-community/eslint-plugin-eslint-comments";
import js from "@eslint/js";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactNativeA11y from "eslint-plugin-react-native-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

// Progi i reguły: docs/architecture/CODING_STANDARDS.md (sekcja 1).
const SOURCE = ["apps/*/src/**/*.{ts,tsx}", "packages/*/src/**/*.{ts,tsx}"];
const TESTS = ["**/*.test.{ts,tsx}"];

const SQL_RAW = "MemberExpression[object.name='sql'][property.name='raw']";
const SQL_RAW_MESSAGE = "sql.raw jest zakazany (TH-20): używaj zapytań parametryzowanych Drizzle.";
const NO_INNER_HTML = {
  selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
  message: "dangerouslySetInnerHTML jest zakazany (TH-15): renderuj treść jako tekst.",
};
const SAFE_SYNTAX = [{ selector: SQL_RAW, message: SQL_RAW_MESSAGE }, NO_INNER_HTML];

// T-044: CHECK w DDL nie przyjmuje parametru ($1), więc schema.ts wkleja stałą liczbową z kodu
// przez sql.raw(String(STAŁA)). Tylko w schema.ts i tylko w tej postaci; inne sql.raw zakazane.
const SAFE_SYNTAX_DDL = [
  {
    selector: `${SQL_RAW}:not(CallExpression[arguments.length=1][arguments.0.callee.name='String'][arguments.0.arguments.0.name=/^[A-Z][A-Z0-9_]*$/] > MemberExpression.callee)`,
    message: SQL_RAW_MESSAGE,
  },
  NO_INNER_HTML,
];

// T-012: limity per IP (MC-04 / MC-05) łączą klientów z tym samym adresem; adres nadaje tylko fixtures.ts.
const E2E_CLIENT_SYNTAX = [
  {
    selector: "Literal[value=/^x-forwarded-for$/i]",
    message:
      "Adres klienta E2E nadaje fixtures.ts (losowy); stały X-Forwarded-For wyczerpuje limity.",
  },
  {
    selector: "CallExpression[callee.property.name='newContext']",
    message: "Drugi klient E2E przez newClient(browser) z fixtures.ts (własny losowy adres).",
  },
];

// T-021: stan „w trakcie” w testach komponentów trzyma heldResponse(), nie okno czasowe delay(ms),
// które pod obciążeniem mija przed kolejnym krokiem testu. Dozwolone: delay() i delay("infinite").
// T-044: dozwolone też `await delay(ms)` zaraz po `live.send(…)` (handler MSW): porządek „zdarzenie
// WS przed odpowiedzią HTTP”, nie okno na kroki testu.
const WEB_TEST_SYNTAX = [
  {
    selector:
      "CallExpression[callee.name='delay'][arguments.length=1]:not([arguments.0.value='infinite']):not(ExpressionStatement:has(CallExpression[callee.object.name='live'][callee.property.name='send']) + ExpressionStatement > AwaitExpression > CallExpression)",
    message:
      "Zamiast delay(ms) wstrzymaj odpowiedź heldResponse() (test/held.ts) i zwolnij ją po asercjach (T-021, layers/web.md).",
  },
];

// T-017: znaczniki czasu z wstrzykiwanego `Clock` (layers/db.md „Konwencje”), nie z zegara bazy —
// klient porównuje wersje pozycji po `updatedAt` (api.md).
// T-044: wyjątek `update(shoppingList).set({ updatedAt: sql`now()` })` — `updated_at` listy tylko
// porządkuje SC-05, klient nie porównuje nim wersji.
const LIST_UPDATED_AT_NOW =
  "CallExpression[callee.property.name='set'][callee.object.callee.property.name='update'][callee.object.arguments.0.name='shoppingList'] > ObjectExpression > Property[key.name='updatedAt'] > TaggedTemplateExpression > TemplateLiteral > TemplateElement";
const API_CLOCK_SYNTAX = [
  {
    selector: `TaggedTemplateExpression[tag.name='sql'] TemplateElement[value.raw=/now\\(\\)/i]:not(${LIST_UPDATED_AT_NOW})`,
    message: "Czas z Clock w domenie (actor.clock.now()), nie now() bazy (T-017, layers/db.md).",
  },
];

// T-035 (TH-21): zdarzenie limitu tylko przez `logLimitEvent` (logging.ts), limit per IP tylko przez
// `perIp` (rate-limit.ts). Ręczny kształt zdarzenia lub `config.rateLimit` trasy rozjeżdżał log
// `security` (T-027, T-033, T-034, T-035).
const API_LIMIT_LOG_SYNTAX = [
  {
    selector:
      "CallExpression[callee.property.name=/^(warn|info|error)$/] > ObjectExpression > Property[key.name='event'][value.value=/^(limit_reached|rate_limited)$/]",
    message:
      "Zdarzenie limitu przez logLimitEvent (src/logging.ts): limit = klucz stałej, zawsze route (T-035, layers/backend.md).",
  },
  {
    selector: "Property[key.name='config'] > ObjectExpression > Property[key.name='rateLimit']",
    message:
      "Limit trasy przez perIp(key) z src/http/rate-limit.ts: tylko on loguje przekroczenie (T-035, layers/backend.md).",
  },
];

// T-018: koniec sesji tylko przez `endSession` (session/useSession.ts). `clear()` usuwa też zapytanie
// sesji obserwowane przez `RequireSession`, więc strażnik nie widzi `null` i nie prowadzi na SC-01.
const WEB_SESSION_SYNTAX = [
  "CallExpression[callee.property.name='clear'][callee.object.name=/client$/i]",
  "CallExpression[callee.property.name='clear'][callee.object.callee.name='useQueryClient']",
].map((selector) => ({
  selector,
  message:
    "Nie czyść QueryClient wprost: koniec sesji przez useSetSession(null) (T-018, layers/web.md „Pułapki”).",
}));

// T-029: wywołania zwrotne zapisu w opcjach `useMutation` / `useGuardedMutation`, nie w `mutate`.
// Te z `mutate` TanStack Query wywołuje tylko dla ostatniego wywołania i nie po odmontowaniu.
const WEB_MUTATE_SYNTAX = [
  {
    selector: "CallExpression[callee.property.name=/^mutate(Async)?$/][arguments.length>1]",
    message:
      "onSuccess / onError / onSettled w opcjach useGuardedMutation, nie w mutate(…) / mutateAsync(…): te z mutate przychodzą tylko dla ostatniego wywołania (T-029, layers/web.md „Pułapki”).",
  },
  // T-043: `variables` (i `isPending`) opisują tylko ostatnie z równoległych wywołań mutacji.
  ...[
    "MemberExpression[property.name='variables']",
    "ObjectPattern > Property[key.name='variables']",
  ].map((selector) => ({
    selector,
    message:
      "Stan zapisu elementu przez isLocked(key) z useGuardedMutation: variables mutacji opisuje tylko ostatnie z równoległych wywołań (T-043, layers/web.md „Pułapki”).",
  })),
];

// T-028: SC-01 ↔ SC-02 przez `EntryLink`, który przenosi wpisany e-mail i zaproszenie.
const WEB_ENTRY_LINK_SYNTAX = [
  {
    selector:
      "JSXOpeningElement[name.name='Link'] > JSXAttribute[name.name='to'][value.value=/^.(logowanie|rejestracja)$/]",
    message:
      "SC-01 ↔ SC-02 przez EntryLink (invitations/EntryLink.tsx): zwykły Link gubi wpisany e-mail i zaproszenie (T-028, layers/web.md „Pułapki”).",
  },
];

// TH-16: token sesji w aplikacji mobilnej tylko w expo-secure-store, nigdy w AsyncStorage.
// Zapis pod kluczem związanym z sesją: literał albo szablon zaczynający się od takiej nazwy.
const SESSION_KEY = "/sess|token|auth|cookie|jwt/i";
const STORAGE_WRITE = "CallExpression[callee.property.name=/^(setItem|mergeItem)$/]";
const MOBILE_SESSION_SYNTAX = [
  `${STORAGE_WRITE}[arguments.0.type='Literal'][arguments.0.value=${SESSION_KEY}]`,
  `${STORAGE_WRITE}[arguments.0.type='TemplateLiteral'][arguments.0.quasis.0.value.raw=${SESSION_KEY}]`,
].map((selector) => ({
  selector,
  message: "Sesja tylko w expo-secure-store, nigdy w AsyncStorage (TH-16).",
}));

const sizeRules = (maxLinesPerFunction) => ({
  complexity: ["error", 10],
  "max-lines-per-function": [
    "error",
    { max: maxLinesPerFunction, skipBlankLines: true, skipComments: true },
  ],
  "max-params": ["error", 4],
  "max-depth": ["error", 3],
  "max-lines": ["error", { max: 300, skipBlankLines: true, skipComments: true }],
});

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/generated/**",
      "**/coverage/**",
      "**/test-results/**",
      "**/playwright-report/**",
      // Projekty natywne generuje expo prebuild.
      "apps/mobile/android/**",
      "apps/mobile/ios/**",
      "apps/mobile/.expo/**",
      "scripts/backlog-check.mjs",
      "scripts/design-check.mjs",
      ".claude/**",
      "docs/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    extends: [tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: { globals: globals.node },
  },
  {
    // Bezpieczne wzorce (TH-15, TH-16, TH-20).
    files: ["**/*.{ts,tsx,js,mjs}"],
    rules: {
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-restricted-syntax": ["error", ...SAFE_SYNTAX],
      "no-restricted-globals": [
        "error",
        { name: "localStorage", message: "Sesja tylko w ciasteczku HttpOnly (TH-16)." },
        { name: "sessionStorage", message: "Sesja tylko w ciasteczku HttpOnly (TH-16)." },
      ],
      "no-restricted-properties": [
        "error",
        {
          object: "window",
          property: "localStorage",
          message: "Sesja tylko w ciasteczku (TH-16).",
        },
        {
          object: "window",
          property: "sessionStorage",
          message: "Sesja tylko w ciasteczku (TH-16).",
        },
      ],
    },
  },
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    extends: [
      react.configs.flat.recommended,
      react.configs.flat["jsx-runtime"],
      reactHooks.configs.flat["recommended-latest"],
      jsxA11y.flatConfigs.strict,
    ],
    languageOptions: { globals: globals.browser },
    settings: { react: { version: "detect" } },
    rules: { "react/no-danger": "error" },
  },
  {
    files: ["apps/mobile/**/*.{ts,tsx}"],
    extends: [
      react.configs.flat.recommended,
      react.configs.flat["jsx-runtime"],
      reactHooks.configs.flat["recommended-latest"],
    ],
    plugins: { "react-native-a11y": reactNativeA11y },
    settings: { react: { version: "detect" } },
    rules: {
      ...reactNativeA11y.configs.all.rules,
      // Podpowiedź opisuje skutek akcji; wymagana tylko przy elementach interaktywnych (przegląd QA).
      "react-native-a11y/has-accessibility-hint": "off",
      // Nadpisanie no-restricted-syntax zastępuje listę, więc powtarza SAFE_SYNTAX.
      "no-restricted-syntax": ["error", ...SAFE_SYNTAX, ...MOBILE_SESSION_SYNTAX],
    },
  },
  {
    // T-030, T-044: reguł z przeglądów nie wyłącza komentarz w kodzie (także `eslint-disable` bez
    // nazwy reguły). Wyjątek tylko w tej konfiguracji: zawężony selektor albo files / ignores
    // z komentarzem.
    files: ["apps/*/src/**/*.{ts,tsx}", "packages/*/src/**/*.ts", "apps/web/test/**/*.{ts,tsx}"],
    plugins: { "eslint-comments": eslintComments },
    rules: {
      "eslint-comments/no-restricted-disable": [
        "error",
        "no-restricted-imports",
        "no-restricted-syntax",
      ],
    },
  },
  {
    // T-020: zapis przez `useGuardedMutation` (synchroniczna blokada podwójnego wysłania).
    // T-019: `RouterProvider` z `react-router/dom` — inaczej `flushSync` po cichu nie działa.
    files: ["apps/web/src/**/*.{ts,tsx}", "apps/web/test/**/*.{ts,tsx}"],
    ignores: ["apps/web/src/api/useGuardedMutation.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@tanstack/react-query",
              importNames: ["useMutation"],
              message:
                "Użyj useGuardedMutation (api/useGuardedMutation.ts): useMutation nie blokuje drugiego wysłania przed przerysowaniem (T-020, layers/web.md „Pułapki”).",
            },
            {
              name: "react-router",
              importNames: ["RouterProvider"],
              message:
                "Importuj RouterProvider z react-router/dom: tylko on obsługuje navigate(…, { flushSync: true }) (T-019).",
            },
          ],
        },
      ],
    },
  },
  {
    // T-027: limit per IP tylko przez helper — on zapisuje przekroczenie w logu `security` (TH-21).
    files: ["apps/api/src/**/*.ts"],
    ignores: ["apps/api/src/http/rate-limit.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@fastify/rate-limit",
              message:
                "Limit per IP przez perIpRateLimit / perIp z src/http/rate-limit.ts: zapisuje przekroczenie w logu security (T-027, layers/backend.md).",
            },
          ],
        },
      ],
    },
  },
  {
    // Nadpisanie no-restricted-syntax zastępuje listę, więc powtarza SAFE_SYNTAX.
    files: ["apps/api/src/**/*.ts"],
    rules: { "no-restricted-syntax": ["error", ...SAFE_SYNTAX, ...API_CLOCK_SYNTAX] },
  },
  {
    // Nadpisanie no-restricted-syntax zastępuje listę, więc powtarza SAFE_SYNTAX i API_CLOCK_SYNTAX.
    files: ["apps/api/src/**/*.ts"],
    ignores: ["apps/api/src/logging.ts", "apps/api/src/http/rate-limit.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...SAFE_SYNTAX,
        ...API_CLOCK_SYNTAX,
        ...API_LIMIT_LOG_SYNTAX,
      ],
    },
  },
  {
    // Nadpisanie no-restricted-syntax zastępuje listę: schema.ts z SAFE_SYNTAX_DDL (T-044).
    files: ["apps/api/src/db/schema.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...SAFE_SYNTAX_DDL,
        ...API_CLOCK_SYNTAX,
        ...API_LIMIT_LOG_SYNTAX,
      ],
    },
  },
  {
    // Nadpisanie no-restricted-syntax zastępuje listę, więc powtarza SAFE_SYNTAX.
    files: ["apps/web/src/**/*.{ts,tsx}"],
    ignores: [...TESTS, "apps/web/src/session/useSession.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...SAFE_SYNTAX,
        ...WEB_SESSION_SYNTAX,
        ...WEB_MUTATE_SYNTAX,
        ...WEB_ENTRY_LINK_SYNTAX,
      ],
    },
  },
  {
    // T-044: „Wróć” na SC-04 cofa w historii; do SC-01 prowadzi tylko przy wejściu wprost, bez
    // e-maila i zaproszenia, więc zwykły Link. Bez WEB_ENTRY_LINK_SYNTAX.
    files: ["apps/web/src/screens/SC-04-regulamin/TermsScreen.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...SAFE_SYNTAX,
        ...WEB_SESSION_SYNTAX,
        ...WEB_MUTATE_SYNTAX,
      ],
    },
  },
  {
    // T-044: useSession.ts jako jedyny czyści QueryClient (koniec sesji, T-018); pozostałe reguły
    // web go obejmują. Bez WEB_SESSION_SYNTAX.
    files: ["apps/web/src/session/useSession.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...SAFE_SYNTAX,
        ...WEB_MUTATE_SYNTAX,
        ...WEB_ENTRY_LINK_SYNTAX,
      ],
    },
  },
  {
    // Nadpisanie no-restricted-syntax zastępuje listę, więc powtarza SAFE_SYNTAX.
    files: ["apps/web/src/**/*.test.{ts,tsx}"],
    rules: { "no-restricted-syntax": ["error", ...SAFE_SYNTAX, ...WEB_TEST_SYNTAX] },
  },
  {
    // Nadpisanie no-restricted-syntax zastępuje listę, więc powtarza SAFE_SYNTAX.
    files: ["apps/web/e2e/**/*.ts"],
    ignores: ["apps/web/e2e/fixtures.ts"],
    rules: { "no-restricted-syntax": ["error", ...SAFE_SYNTAX, ...E2E_CLIENT_SYNTAX] },
  },
  // CODING_STANDARDS.md: progi rozmiaru dla kodu źródłowego, bez testów.
  { files: SOURCE, ignores: TESTS, rules: sizeRules(60) },
  { files: ["apps/web/src/**/*.tsx"], ignores: TESTS, rules: sizeRules(80) },
);
