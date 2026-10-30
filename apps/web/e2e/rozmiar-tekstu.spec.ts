import type { Locator } from "@playwright/test";
import { expect, test } from "./fixtures";
import { add, openNewList } from "./lists";

const fontSize = (locator: Locator) =>
  locator.evaluate((element) => parseFloat(getComputedStyle(element).fontSize));

// T-016 AC2: tekst SC-06 idzie za rozmiarem tekstu przeglądarki (tokeny w rem, WCAG 1.4.4).
test("SC-06 text scales with the browser text size", async ({ page }) => {
  await openNewList(page, "Dom");
  await add(page, "Mleko", "2 l");
  const title = page.getByRole("heading", { level: 1, name: "Dom" });
  const item = page.getByRole("button", { name: "Edytuj Mleko" });
  const details = page.getByText("2 l · dodał(a) Ania");
  await expect(item).toBeVisible();

  expect([await fontSize(title), await fontSize(item), await fontSize(details)]).toEqual([
    20, 18, 14,
  ]);

  // Ustawienie przeglądarki: domyślny rozmiar tekstu 20 px zamiast 16 px (Chromium, CDP).
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Page.setFontSizes", { fontSizes: { standard: 20 } });

  expect([await fontSize(title), await fontSize(item), await fontSize(details)]).toEqual([
    25, 22.5, 17.5,
  ]);
});
