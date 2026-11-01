import type { Browser, Page } from "@playwright/test";
import { expect, expectNoAxeViolations, newAccount, newClient, signUp, test } from "./fixtures";
import { api, openNewList } from "./lists";

// N-06 / F-14: zmiana innej osoby widoczna w ≤ 5 s bez odświeżania.
const LIVE = { timeout: 5_000 };

/** Nowe konto w osobnym kliencie, dołączone do listy linkiem utworzonym przez właściciela. */
async function joinWithLink(owner: Page, browser: Browser, listId: string, name: string) {
  const created = await api(owner).post(`/api/v1/lists/${listId}/invitations`, {});
  expect(created.status()).toBe(201);
  const { url } = (await created.json()) as { url: string };
  const client = await newClient(browser);
  const page = await client.newPage();
  const account = { ...newAccount(), name };
  await signUp(page, account);
  await expect(page.getByRole("heading", { level: 1, name: "Moje listy" })).toBeVisible();
  const accepted = await api(page).post(
    `/api/v1/invitations/${url.split("/").pop() ?? ""}/accept`,
    {},
  );
  expect(accepted.status()).toBe(200);
  return { client, page, email: account.email };
}

function members(page: Page) {
  return page.getByRole("region", { name: /^Na liście/ });
}

// T-057 AC2, AC4, AC5 (F-13): właściciel widzi e-maile, uczestnik nie; dołączenie na żywo u obu.
test("SC-07 shows who is on the list, e-mails only to the owner, joins live", async ({
  page,
  browser,
}) => {
  const list = await openNewList(page, "Dom");
  const tomek = await joinWithLink(page, browser, list.id, "Tomek");

  await page.goto(`/listy/${list.id}/uczestnicy`);
  await expect(page.getByRole("heading", { level: 2, name: "Na liście (1 z 20)" })).toBeVisible();
  await expect(members(page).getByText(tomek.email)).toBeVisible();
  await expectNoAxeViolations(page);

  await tomek.page.goto(`/listy/${list.id}/uczestnicy`);
  const tomeksView = members(tomek.page);
  await expect(tomeksView.getByRole("listitem")).toHaveText([/^AAniawłaściciel$/, /^TTomekTy$/]);
  await expect(tomek.page.getByText(/@example\.com/)).toHaveCount(0);
  await expect(tomek.page.getByRole("region", { name: "Zaproszenia" })).toHaveCount(0);
  await expectNoAxeViolations(tomek.page);

  const kasia = await joinWithLink(page, browser, list.id, "Kasia");
  await expect(page.getByRole("heading", { level: 2, name: "Na liście (2 z 20)" })).toBeVisible(
    LIVE,
  );
  await expect(members(page).getByText(kasia.email)).toBeVisible();
  await expect(
    tomek.page.getByRole("heading", { level: 2, name: "Na liście (2 z 20)" }),
  ).toBeVisible(LIVE);
  await expect(tomeksView.getByRole("listitem").last()).toHaveText(/^KKasia$/);
  await kasia.client.close();
  await tomek.client.close();
});

// T-057 AC3, AC5: pusty stan i błąd wczytania uczestników przechodzą axe.
test("SC-07 empty and load error states pass axe", async ({ page }) => {
  const list = await openNewList(page, "Dom");
  await page.goto(`/listy/${list.id}/uczestnicy`);
  await expect(page.getByRole("heading", { level: 2, name: "Na liście (0 z 20)" })).toBeVisible();
  await expect(
    page.getByText("Nikt jeszcze nie dołączył. Utwórz link i wyślij go domownikowi."),
  ).toBeVisible();
  await expectNoAxeViolations(page);

  await page.route(`**/api/v1/lists/${list.id}/members`, (route) =>
    route.fulfill({ status: 500, json: { error: { code: "internal", requestId: "r" } } }),
  );
  await page.reload();
  // Klient ponawia błędy 5xx (queryClient.ts), więc komunikat po kilku próbach.
  await expect(page.getByText("Nie udało się wczytać uczestników.")).toBeVisible({
    timeout: 15_000,
  });
  const retry = page.getByRole("button", { name: "Spróbuj ponownie" });
  await expectNoAxeViolations(page);
  await page.unroute(`**/api/v1/lists/${list.id}/members`);
  await retry.click();
  await expect(page.getByRole("heading", { level: 2, name: "Na liście (0 z 20)" })).toBeVisible();
});

// T-058 AC3, AC5 (F-13, MC-03): usunięty z otwartą listą (SC-06 albo SC-07) wraca na SC-05.
test("SC-07 owner removes participants who have the list open; they land on SC-05", async ({
  page,
  browser,
}) => {
  const list = await openNewList(page, "Dom");
  const tomek = await joinWithLink(page, browser, list.id, "Tomek");
  const ola = await joinWithLink(page, browser, list.id, "Ola");
  await tomek.page.goto(`/listy/${list.id}`);
  await expect(tomek.page.getByRole("heading", { level: 1, name: "Dom" })).toBeVisible();
  await ola.page.goto(`/listy/${list.id}/uczestnicy`);
  await expect(
    ola.page.getByRole("heading", { level: 2, name: "Na liście (2 z 20)" }),
  ).toBeVisible();

  await page.goto(`/listy/${list.id}/uczestnicy`);
  await expect(page.getByRole("heading", { level: 2, name: "Na liście (2 z 20)" })).toBeVisible();
  await page.getByRole("button", { name: "Usuń Tomek z listy" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Usunąć Tomek z listy?" });
  await expect(dialog.getByRole("button", { name: "Anuluj" })).toBeFocused();
  await expectNoAxeViolations(page);
  await dialog.getByRole("button", { name: "Usuń" }).click();

  await expect(page.getByRole("heading", { level: 2, name: "Na liście (1 z 20)" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Usuń Ola z listy" })).toBeFocused();
  await expectNoAxeViolations(page);

  await expectBackOnLists(tomek.page);

  await page.getByRole("button", { name: "Usuń Ola z listy" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Usuń" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Na liście (0 z 20)" })).toBeFocused();
  await expectBackOnLists(ola.page);
  await tomek.client.close();
  await ola.client.close();
});

/** MC-03: SC-05 z komunikatem, bez usuniętej listy. */
async function expectBackOnLists(removed: Page) {
  await expect(
    removed.getByText("Lista „Dom” została usunięta albo nie masz już do niej dostępu."),
  ).toBeVisible(LIVE);
  await expect(removed.getByRole("heading", { level: 1, name: "Moje listy" })).toBeVisible();
  expect(new URL(removed.url()).pathname).toBe("/listy");
  await expect(removed.getByText("Dom", { exact: true })).toHaveCount(0);
  await expectNoAxeViolations(removed);
}
