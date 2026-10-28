import js from "@eslint/js";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
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
    // Nadpisanie no-restricted-syntax zastępuje listę, więc powtarza SAFE_SYNTAX.
    files: ["apps/web/e2e/**/*.ts"],
    ignores: ["apps/web/e2e/fixtures.ts"],
    rules: { "no-restricted-syntax": ["error", ...SAFE_SYNTAX, ...E2E_CLIENT_SYNTAX] },
  },
  // CODING_STANDARDS.md: progi rozmiaru dla kodu źródłowego, bez testów.
  { files: SOURCE, ignores: TESTS, rules: sizeRules(60) },
  { files: ["apps/web/src/**/*.tsx"], ignores: TESTS, rules: sizeRules(80) },
);
