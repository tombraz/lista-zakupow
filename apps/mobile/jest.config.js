// Testy ekranów: Jest (preset Expo) + RNTL + MSW (testing-strategy.md, layers/mobile.md).
const expoPreset = require("jest-expo/jest-preset");

// MSW i jego zależności są ESM-only: Babel z presetu Expo kompiluje je do CommonJS.
const ESM_PACKAGES = [
  "msw",
  "@msw",
  "@mswjs",
  "cookie",
  "headers-polyfill",
  "is-node-process",
  "outvariant",
  "rettime",
  "tough-cookie",
  "tldts",
  "tldts-core",
  "until-async",
  "@open-draft",
];
const babelTransform = expoPreset.transform["\\.[jt]sx?$"];

/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  testEnvironment: "<rootDir>/test/environment.js",
  // Po setupie presetu (Jest dokleja pliki projektu za plikami presetu).
  setupFiles: ["<rootDir>/test/node-fetch.js"],
  setupFilesAfterEnv: ["<rootDir>/test/setup.ts"],
  testMatch: ["**/src/**/*.test.ts?(x)", "**/test/**/*.test.ts?(x)"],
  transform: { "\\.mjs$": babelTransform },
  transformIgnorePatterns: expoPreset.transformIgnorePatterns.map((pattern, index) =>
    index === 0 ? pattern.replace("(?!(", `(?!(${ESM_PACKAGES.join("|")}|`) : pattern,
  ),
};
