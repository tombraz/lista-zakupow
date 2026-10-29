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
    files: ["apps/web/src/**/*.{ts,tsx}"],
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
          ],
        },
      ],
    },
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
