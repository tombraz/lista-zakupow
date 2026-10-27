import { expect, expectNoAxeViolations, test } from "./fixtures";

// T-001 AC5: API serwuje SPA pod każdą ścieżką spoza /api i /health. Od T-004 SPA zaczyna
// od logowania (SC-01) zamiast ekranu stanu API.
for (const path of ["/", "/dowolna/sciezka"]) {
  test(`${path} serves the SPA, which opens SC-01 for an anonymous person`, async ({ page }) => {
    await page.goto(path);

    await expect(page.locator("html")).toHaveAttribute("lang", "pl");
    await expect(page.getByRole("heading", { level: 1, name: "Zaloguj się" })).toBeVisible();
    await expectNoAxeViolations(page);
  });
}
