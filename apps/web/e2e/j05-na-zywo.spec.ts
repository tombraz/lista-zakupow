import { expect, expectNoAxeViolations, newAccount, newClient, signUp, test } from "./fixtures";
import { add, api, openNewList } from "./lists";

// N-06 / F-14: zmiana innej osoby widoczna w ≤ 5 s bez odświeżania.
const LIVE = { timeout: 5_000 };

// J-05: dwie osoby na jednej liście — odhaczenie, dodanie, zmiana nazwy i usunięcie listy na żywo
// (AC4, AC5, AC9, SEC2).
test("J-05 two people shopping together see each other's changes live", async ({
  page,
  browser,
}) => {
  const list = await openNewList(page, "Dom");
  for (const name of ["Mleko", "Chleb"]) {
    await add(page, name);
    // Zapis zakończony (ogłoszenie po odpowiedzi API); sam wiersz może przyjść wcześniej na żywo.
    await expect(page.getByRole("status").filter({ hasText: `Dodano ${name}` })).toBeAttached();
  }
  await expect(page.getByText("2 do kupienia")).toBeVisible();
  const invitation = await api(page).post(`/api/v1/lists/${list.id}/invitations`, {});
  const { url } = (await invitation.json()) as { url: string };

  const tomekClient = await newClient(browser);
  const tomek = await tomekClient.newPage();
  await signUp(tomek, { ...newAccount(), name: "Tomek" });
  await expect(tomek.getByRole("heading", { level: 1, name: "Moje listy" })).toBeVisible();
  const token = url.split("/").pop() ?? "";
  await api(tomek).post(`/api/v1/invitations/${token}/accept`, {});
  await tomek.goto(`/listy/${list.id}`);
  await expect(tomek.getByRole("heading", { level: 1, name: "Dom" })).toBeVisible();

  await tomek.getByRole("button", { name: "Odhacz Mleko" }).click();
  await expect(page.getByText("1 do kupienia")).toBeVisible(LIVE);
  await expect(page.getByRole("button", { name: "Kupione (1)" })).toBeVisible(LIVE);
  await expectNoAxeViolations(page);

  await add(tomek, "Masło");
  await expect(page.getByRole("button", { name: "Edytuj Masło" })).toBeVisible(LIVE);
  await expect(page.getByText("2 do kupienia")).toBeVisible();

  await api(page).post(`/api/v1/lists/${list.id}/items`, { name: "Jajka" });
  await expect(tomek.getByRole("button", { name: "Edytuj Jajka" })).toBeVisible(LIVE);

  await page.getByRole("button", { name: "Więcej opcji" }).click();
  await page.getByRole("button", { name: "Zmień nazwę listy" }).click();
  await page.getByRole("dialog").getByLabel("Nazwa listy").fill("Dom i działka");
  await page.getByRole("dialog").getByRole("button", { name: "Zapisz" }).click();
  await expect(tomek.getByRole("heading", { level: 1, name: "Dom i działka" })).toBeVisible(LIVE);

  await page.getByRole("button", { name: "Więcej opcji" }).click();
  await page.getByRole("button", { name: "Usuń listę" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Usuń listę" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Moje listy" })).toBeVisible();

  await expect(
    tomek.getByText("Lista „Dom i działka” została usunięta albo nie masz już do niej dostępu."),
  ).toBeVisible(LIVE);
  await expect(tomek.getByRole("heading", { level: 1, name: "Moje listy" })).toBeVisible();
  expect(new URL(tomek.url()).pathname).toBe("/listy");
  await expectNoAxeViolations(tomek);
  await tomekClient.close();
});
