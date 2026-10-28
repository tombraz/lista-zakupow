import type { Page } from "@playwright/test";
import { expect, expectNoAxeViolations, test } from "./fixtures";
import { add, openNewList } from "./lists";

async function shoppingList(page: Page) {
  await openNewList(page, "Dom");
  for (const name of ["Mleko", "Chleb", "Jajka"]) {
    await add(page, name);
    await expect(page.getByRole("button", { name: `Edytuj ${name}` })).toBeVisible();
  }
}

const toBuy = (page: Page) => page.getByRole("list", { name: "Do kupienia" });

// J-03 (reszta, T-007): odhaczenie, „kto kupił”, duplikat kupionej, usuń kupione; axe (AC3, AC8).
test("J-03 checks items, blocks a duplicate of a bought one and clears the bought", async ({
  page,
}) => {
  await shoppingList(page);
  await expect(page.getByText("3 do kupienia")).toBeVisible();

  await toBuy(page).getByRole("button", { name: "Odhacz Chleb" }).focus();
  await page.keyboard.press("Space");

  await expect(page.getByText("2 do kupienia")).toBeVisible();
  await expect(toBuy(page).getByRole("button", { name: "Odhacz Mleko" })).toBeFocused();
  await expect(page.getByRole("status").filter({ hasText: "Odhaczono Chleb" })).toBeAttached();
  const section = page.getByRole("button", { name: "Kupione (1)" });
  await expect(section).toHaveAttribute("aria-expanded", "false");
  await expectNoAxeViolations(page);

  await section.click();
  const bought = page.getByRole("list", { name: "Kupione" });
  await expect(bought.getByRole("button", { name: "Odznacz Chleb" })).toBeVisible();
  await expect(bought.getByText("kupił(a) Ania")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Do kupienia" })).toBeAttached();
  await expect(page.getByRole("heading", { name: "Kupione (1)" })).toBeVisible();
  await expectNoAxeViolations(page);

  await section.click();
  await add(page, "chleb");
  await expect(page.getByRole("alert")).toContainText(
    "„Chleb” jest już na liście jako kupione. Odznacz tę pozycję w sekcji „Kupione”, żeby kupić ponownie.",
  );
  await page.getByRole("button", { name: "Pokaż" }).click();
  await expect(bought.getByRole("button", { name: "Odznacz Chleb" })).toBeFocused();
  await page.getByLabel("Co kupić?").fill("");

  await toBuy(page).getByRole("button", { name: "Odhacz Jajka" }).click();
  await expect(page.getByText("1 do kupienia")).toBeVisible();
  await page.getByRole("button", { name: "Usuń wszystkie kupione" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Usunąć 2 kupionych pozycji?" });
  await expect(dialog.getByRole("button", { name: "Anuluj" })).toBeFocused();
  await expectNoAxeViolations(page);
  await dialog.getByRole("button", { name: "Usuń kupione" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: /^Kupione/ })).toHaveCount(0);
  await expect(toBuy(page).getByRole("button", { name: "Odhacz Mleko" })).toBeVisible();
  await expect(page.getByText("1 do kupienia")).toBeVisible();

  await page.getByRole("link", { name: "Wstecz" }).click();
  await expect(page.getByRole("link", { name: "Dom, 1 do kupienia" })).toBeVisible();
});

// AC3, AC8: „ogranicz ruch” — przeniesienie bez animacji; „Wszystko kupione.” bez naruszeń axe.
test("SC-06 moves a checked item without animation under reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openNewList(page, "Dom");
  await add(page, "Mleko");
  const checkbox = toBuy(page).getByRole("button", { name: "Odhacz Mleko" });
  await expect(checkbox).toBeVisible();

  await checkbox.click();

  await expect(page.getByText("Wszystko kupione.")).toBeVisible();
  const running = await page.evaluate(
    () => document.getAnimations().filter((animation) => animation.playState === "running").length,
  );
  expect(running).toBe(0);
  await expect(page.getByRole("button", { name: "Kupione (1)" })).toBeFocused();
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Kupione (1)" }).click();
  await expectNoAxeViolations(page);

  await page.getByRole("link", { name: "Wstecz" }).click();
  await expect(page.getByRole("link", { name: "Dom, Wszystko kupione" })).toBeVisible();
});
