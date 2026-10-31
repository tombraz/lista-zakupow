import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["apps/api", "apps/web", "packages/shared", "packages/tokens"],
    // Komunikaty porażek ostatniego przebiegu zostają w pliku: niestabilna porażka z terminala
    // znika przy kolejnym uruchomieniu i nie da się jej przeanalizować (T-047).
    reporters: ["default", "junit"],
    outputFile: { junit: "test-results/vitest-junit.xml" },
    // Raport pokrycia jako artefakt CI, bez progu blokującego (pipeline.md, etap 2).
    coverage: {
      provider: "v8",
      include: ["apps/*/src/**", "packages/*/src/**"],
      reporter: ["text-summary", "html"],
    },
  },
});
