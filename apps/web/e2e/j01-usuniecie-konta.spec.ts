import type { Page } from "@playwright/test";
import { expect, expectNoAxeViolations, newAccount, newClient, signUp, test } from "./fixtures";
import { api } from "./lists";

// N-06 / F-14: zmiana innej osoby widoczna w ≤ 5 s bez odświeżania.
const LIVE = { timeout: 5_000 };

/** Lista przez API w sesji strony; zwraca jej `id` i token linku zaproszenia. */
async function sharedList(page: Page, name: string) {
  const created = await api(page).post("/api/v1/lists", { name });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };
  const invitation = await api(page).post(`/api/v1/lists/${id}/invitations`, {});
  expect(invitation.status()).toBe(201);
  const { url } = (await invitation.json()) as { url: string };
  return { id, token: url.split("/").pop() ?? "" };
}

async function join(page: Page, token: string) {
  const accepted = await api(page).post(`/api/v1/invitations/${token}/accept`, {});
  expect(accepted.ok()).toBe(true);
}

// T-062 AC3, AC5 (F-04): Ania usuwa konto; Tomek z otwartą „Dom” wraca na SC-05, a na jego
// „Działka” pozycja Ani zostaje z podpisem „usunięty użytkownik”.
test("F-04 deleting the account removes its lists live and keeps its items on others' lists", async ({
  page,
  browser,
}) => {
  const ania = newAccount();
  await signUp(page, ania);
  await expect(page.getByRole("heading", { level: 1, name: "Moje listy" })).toBeVisible();
  const home = await sharedList(page, "Dom");
  const tomekClient = await newClient(browser);
  const tomek = await tomekClient.newPage();
  await signUp(tomek, { ...newAccount(), name: "Tomek" });
  await expect(tomek.getByRole("heading", { level: 1, name: "Moje listy" })).toBeVisible();
  await join(tomek, home.token);
  const plot = await sharedList(tomek, "Działka");
  await join(page, plot.token);
  const coal = await api(page).post(`/api/v1/lists/${plot.id}/items`, { name: "Węgiel" });
  expect(coal.status()).toBe(201);
  await tomek.goto(`/listy/${home.id}`);
  await expect(tomek.getByRole("heading", { level: 1, name: "Dom" })).toBeVisible();

  await page.goto("/konto");
  await expect(page.getByRole("heading", { level: 2, name: "Usuń konto" })).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Usuń konto" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Usunąć konto na zawsze?" });
  await expect(dialog).toContainText(
    "1 Twoich list zniknie, także u ich uczestników. Tego nie da się cofnąć.",
  );
  await expect(dialog.getByRole("button", { name: "Anuluj" })).toBeFocused();
  await expectNoAxeViolations(page);
  await dialog.getByRole("button", { name: "Usuń konto" }).click();

  await expect(
    page.getByRole("status").filter({ hasText: "Konto zostało usunięte." }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Zaloguj się" })).toBeVisible();
  await expect(page).toHaveURL(/\/logowanie$/);
  await expectNoAxeViolations(page);

  await expect(
    tomek.getByText("Lista „Dom” została usunięta albo nie masz już do niej dostępu."),
  ).toBeVisible(LIVE);
  await expect(tomek.getByRole("heading", { level: 1, name: "Moje listy" })).toBeVisible();
  await tomek.goto(`/listy/${plot.id}`);
  await expect(tomek.getByText(/dodał\(a\) usunięty użytkownik/)).toBeVisible();

  await page.getByLabel("E-mail").fill(ania.email);
  await page.getByLabel("Hasło", { exact: true }).fill(ania.password);
  await page.getByRole("button", { name: "Zaloguj się" }).click();
  await expect(page.getByText("Nieprawidłowy e-mail lub hasło.")).toBeVisible();
  await tomekClient.close();
});
