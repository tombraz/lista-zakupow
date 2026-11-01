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
