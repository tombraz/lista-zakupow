import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const path of ["/", "/dowolna/sciezka"]) {
  test(`${path} serves the SPA that shows API and database status (AC5)`, async ({ page }) => {
    await page.goto(path);

    await expect(page.locator("html")).toHaveAttribute("lang", "pl");
    await expect(
      page.getByRole("heading", { level: 1, name: "Wspólna lista zakupów" }),
    ).toBeVisible();
    await expect(page.getByRole("status")).toHaveText("API działa · baza działa");

    const scan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(scan.violations).toEqual([]);
  });
}
