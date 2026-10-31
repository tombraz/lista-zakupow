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

/** Na ilu liniach leży słowo w elemencie (więcej niż 1 = złamane w środku). */
const linesOfWord = (locator: Locator, word: string) =>
  locator.evaluate((element, searched) => {
    const text = element.firstChild as Text;
    const start = text.data.indexOf(searched);
    const range = document.createRange();
    range.setStart(text, start);
    range.setEnd(text, start + searched.length);
    return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size;
  }, word);

// T-016 AC3 (QA runda 1 #1): przy 200% tekstu na telefonie tytuł AppBar ma najwyżej 2 linie,
// potem wielokropek, i nie łamie słów w środku (design-system.md, AppBar).
test("SC-06 AppBar title stays within 2 lines at 200% text on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const name = "Zakupy na weekend u babci";
  await openNewList(page, name);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Page.setFontSizes", { fontSizes: { standard: 32 } });

  const title = page.getByRole("heading", { level: 1, name });
  const { height, lineHeight } = await title.evaluate((element) => ({
    height: element.getBoundingClientRect().height,
    lineHeight: parseFloat(getComputedStyle(element).lineHeight),
  }));
  expect(lineHeight).toBe(50);
  expect(height).toBeLessThanOrEqual(2 * lineHeight);
  expect(await linesOfWord(title, "Zakupy")).toBe(1);
});

// T-016 (prewencja, QA runda 2): przy 100% tekstu długa nazwa listy nie rozpycha paska —
// tytuł kończy się wielokropkiem po 2 liniach (line-clamp), zamiast zawijać się dalej.
test("SC-06 AppBar title is cut after 2 lines at 100% text on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const name = "Zakupy na długi weekend majowy u babci i dziadka w Zakopanem";
  await openNewList(page, name);

  const title = page.getByRole("heading", { level: 1, name });
  const { height, lineHeight, cut } = await title.evaluate((element) => ({
    height: element.getBoundingClientRect().height,
    lineHeight: parseFloat(getComputedStyle(element).lineHeight),
    cut: element.scrollHeight > element.clientHeight,
  }));
  expect(lineHeight).toBe(25);
  expect(height).toBeLessThanOrEqual(2 * lineHeight);
  expect(cut).toBe(true);
});
