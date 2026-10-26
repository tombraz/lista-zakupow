import { defineConfig, devices } from "@playwright/test";

const port = process.env["E2E_PORT"] ?? "3100";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // Windows: zamknięcie gniazda przez API blokuje jego pętlę zdarzeń ~10 s, gdy równolegle kończy
  // pracę inny proces przeglądarki (zmierzone w T-001). Na Linuksie (CI) testy idą równolegle.
  ...(process.platform === "win32" ? { workers: 1 } : {}),
  forbidOnly: Boolean(process.env["CI"]),
  reporter: process.env["CI"] ? "github" : "list",
  use: { baseURL: `http://127.0.0.1:${port}`, trace: "retain-on-failure" },
  projects: [
    {
      name: "telefon",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },
    },
    {
      name: "komputer",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    command: "tsx e2e/server.ts",
    url: `http://127.0.0.1:${port}/health/ready`,
    timeout: 120_000,
    reuseExistingServer: false,
    env: { E2E_PORT: port },
  },
});
