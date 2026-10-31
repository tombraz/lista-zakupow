import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "api",
    include: ["test/**/*.test.ts"],
    globalSetup: ["./test/global-setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    // Plik i tak dostaje własną bazę (`useTestDatabase`); bez izolacji worker importuje Fastify
    // i Better Auth raz, a nie w każdym pliku (połowa czasu przebiegu, T-021).
    isolate: false,
  },
});
