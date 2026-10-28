import type { Page } from "@playwright/test";
import { expect, expectNoAxeViolations, newAccount, newClient, signUp, test } from "./fixtures";

const NAME_FIELD = "Nazwa listy";

async function createListViaUi(page: Page, name: string) {
  await page.getByRole("button", { name: /Utwórz pierwszą listę|\+ Nowa lista/ }).click();
  await page.getByLabel(NAME_FIELD).fill(name);
  await page.getByRole("button", { name: "Utwórz" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

/** Lista przez API w sesji strony (jak przeglądarka: ten sam origin, to samo ciasteczko). */
async function createListViaApi(page: Page, name: string) {
  const response = await page.request.post("/api/v1/lists", {
    data: { name },
    headers: { origin: new URL(page.url()).origin },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as { id: string };
}

// J-02: utworzenie, zmiana nazwy i usunięcie listy (AC1, AC2, AC6–AC8).
test("J-02 creates, renames and deletes a list", async ({ page }) => {
  await signUp(page, newAccount());

  await expect(page.getByText("Nie masz jeszcze żadnej listy.")).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByRole("button", { name: "Utwórz pierwszą listę" }).click();
  await expect(page.getByLabel(NAME_FIELD)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Utwórz pierwszą listę" })).toBeFocused();

  await page.getByRole("button", { name: "Utwórz pierwszą listę" }).click();
  await page.getByRole("button", { name: "Utwórz" }).click();
  await expect(page.getByText("Wpisz nazwę listy")).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByLabel(NAME_FIELD).fill("  Zakupy na tydzień  ");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "Zakupy na tydzień" })).toBeVisible();
  await expect(
    page.getByText("Lista jest pusta. Dopisz pierwszą rzecz w polu na dole."),
  ).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByRole("button", { name: "Więcej opcji" }).click();
  await page.getByRole("button", { name: "Zmień nazwę listy" }).click();
  const sheet = page.getByRole("dialog", { name: "Zmień nazwę listy" });
  await expect(sheet.getByLabel(NAME_FIELD)).toBeFocused();
  await expectNoAxeViolations(page);
  await sheet.getByLabel(NAME_FIELD).fill("Dom");
  await sheet.getByRole("button", { name: "Zapisz" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Dom" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Więcej opcji" })).toBeFocused();

  await page.getByRole("link", { name: /Wstecz/ }).click();
  await expect(page.getByRole("link", { name: "Dom, Wszystko kupione" })).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByRole("link", { name: "Dom, Wszystko kupione" }).click();
  await page.getByRole("button", { name: "Więcej opcji" }).click();
  await page.getByRole("button", { name: "Usuń listę" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Usunąć listę „Dom”?" });
  await expect(dialog.getByRole("button", { name: "Anuluj" })).toBeFocused();
  await expectNoAxeViolations(page);
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Usuń listę" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Anuluj" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Więcej opcji" })).toBeFocused();

  await page.getByRole("button", { name: "Więcej opcji" }).click();
  await page.getByRole("button", { name: "Usuń listę" }).click();
  await dialog.getByRole("button", { name: "Usuń listę" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Moje listy" })).toBeVisible();
  await expect(page.getByText("Nie masz jeszcze żadnej listy.")).toBeVisible();
});

// SEC3 (TH-01, MC-01): drugie konto pod adresem cudzej listy nie widzi jej treści.
test("SEC3 another account sees no content of someone else's list", async ({ page, browser }) => {
  await signUp(page, newAccount());
  await createListViaUi(page, "Tajna lista Ani");
  const address = new URL(page.url()).pathname;

  const other = await newClient(browser);
  const bartek = await other.newPage();
  await signUp(bartek, { ...newAccount(), name: "Bartek" });
  await expect(bartek.getByRole("heading", { level: 1, name: "Moje listy" })).toBeVisible();
  await bartek.goto(address);

  await expect(
    bartek.getByRole("heading", { level: 1, name: "Nie masz dostępu do tej listy." }),
  ).toBeVisible();
  await expect(bartek.getByRole("link", { name: "Wróć do moich list" })).toBeVisible();
  await expect(bartek.getByText("Tajna lista Ani")).toHaveCount(0);
  await expect(bartek.getByRole("button", { name: "Więcej opcji" })).toHaveCount(0);
  await expectNoAxeViolations(bartek);
  await other.close();
});

// AC3, AC8: stan limitu 50 list.
test("SC-05 at 50 own lists warns and disables „+ Nowa lista”", async ({ page }) => {
  await signUp(page, newAccount());
  await expect(page.getByText("Nie masz jeszcze żadnej listy.")).toBeVisible();
  for (let index = 1; index <= 50; index += 1)
    await createListViaApi(page, `Lista ${String(index)}`);

  await page.reload();

  await expect(
    page.getByText(
      "Masz już 50 list — to limit. Usuń listę, której nie używasz, żeby utworzyć nową.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "+ Nowa lista" })).toBeDisabled();
  await expectNoAxeViolations(page);
});
