import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["apps/api", "apps/web", "packages/shared", "packages/tokens"],
    // Raport pokrycia jako artefakt CI, bez progu blokującego (pipeline.md, etap 2).
    coverage: {
      provider: "v8",
      include: ["apps/*/src/**", "packages/*/src/**"],
      reporter: ["text-summary", "html"],
    },
  },
});
