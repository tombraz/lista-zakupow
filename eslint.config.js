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

const SAFE_SYNTAX = [
  {
    selector: "MemberExpression[object.name='sql'][property.name='raw']",
    message: "sql.raw jest zakazany (TH-20): używaj zapytań parametryzowanych Drizzle.",
  },
  {
    selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
    message: "dangerouslySetInnerHTML jest zakazany (TH-15): renderuj treść jako tekst.",
  },
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
const WEB_TEST_SYNTAX = [
  {
    selector:
      "CallExpression[callee.name='delay'][arguments.length=1]:not([arguments.0.value='infinite'])",
    message:
      "Zamiast delay(ms) wstrzymaj odpowiedź heldResponse() (test/held.ts) i zwolnij ją po asercjach (T-021, layers/web.md).",
  },
];

// T-017: znaczniki czasu z wstrzykiwanego `Clock` (layers/db.md „Konwencje”), nie z zegara bazy —
// klient porównuje wersje pozycji po `updatedAt` (api.md).
const API_CLOCK_SYNTAX = [
  {
    selector: "TaggedTemplateExpression[tag.name='sql'] TemplateElement[value.raw=/now\\(\\)/i]",
    message: "Czas z Clock w domenie (actor.clock.now()), nie now() bazy (T-017, layers/db.md).",
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
    selector: "CallExpression[callee.property.name='mutate'][arguments.length>1]",
    message:
      "onSuccess / onError / onSettled w opcjach useGuardedMutation, nie w mutate(…): te z mutate przychodzą tylko dla ostatniego wywołania (T-029, layers/web.md „Pułapki”).",
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
    // Nadpisanie no-restricted-syntax zastępuje listę, więc powtarza SAFE_SYNTAX.
    files: ["apps/api/src/**/*.ts"],
    rules: { "no-restricted-syntax": ["error", ...SAFE_SYNTAX, ...API_CLOCK_SYNTAX] },
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
