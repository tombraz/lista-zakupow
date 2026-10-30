import eslintComments from "@eslint-community/eslint-plugin-eslint-comments";
import tseslint from "typescript-eslint";

// T-030, T-044, T-045: komentarze w kodzie nie zmieniają reguł. Osobny przebieg z --no-inline-config
// (`pnpm lint`), bo regułę ESLint wyłącza komentarz w tym samym pliku, także te poniżej.
// Reguł z przeglądów nie wyłącza `eslint-disable` (także bez nazwy reguły); wyjątek tylko
// w eslint.config.js: zawężony selektor albo files / ignores z komentarzem. Komentarze
// konfiguracyjne (`/* eslint reguła: … */`, `/* global */`, `/* eslint-env */`, `/* exported */`)
// zakazane: reguły zmienia tylko eslint.config.js.
export default tseslint.config({
  files: [
    "apps/*/src/**/*.{ts,tsx}",
    "packages/*/src/**/*.{ts,tsx}",
    "apps/web/test/**/*.{ts,tsx}",
  ],
  languageOptions: { parser: tseslint.parser },
  linterOptions: { reportUnusedDisableDirectives: "off" },
  plugins: { "eslint-comments": eslintComments },
  rules: {
    "eslint-comments/no-restricted-disable": [
      "error",
      "no-restricted-imports",
      "no-restricted-syntax",
      "eslint-comments/*",
    ],
    "eslint-comments/no-use": [
      "error",
      {
        allow: [
          "eslint-disable",
          "eslint-disable-line",
          "eslint-disable-next-line",
          "eslint-enable",
        ],
      },
    ],
  },
});
