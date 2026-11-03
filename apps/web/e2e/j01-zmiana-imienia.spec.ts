import type { Page } from "@playwright/test";
import { expect, expectNoAxeViolations, newAccount, newClient, signUp, test } from "./fixtures";
import { add, api, openNewList } from "./lists";

// N-06 / F-14: zmiana innej osoby widoczna w ≤ 5 s bez odświeżania.
const LIVE = { timeout: 5_000 };

async function saveName(page: Page, name: string) {
  await page.getByRole("textbox", { name: "Imię" }).fill(name);
  await page.getByRole("button", { name: "Zapisz imię" }).click();
}

// T-061 AC3 (F-16): nowe imię Tomka u Ani z otwartą listą (SC-06) i uczestnikami (SC-07).
test("F-16 a new name shows up live next to the person's items and in the participants", async ({
  page,
  browser,
}) => {
  const list = await openNewList(page, "Dom");
  const invitation = await api(page).post(`/api/v1/lists/${list.id}/invitations`, {});
  const { url } = (await invitation.json()) as { url: string };
  const tomekClient = await newClient(browser);
  const tomek = await tomekClient.newPage();
  await signUp(tomek, { ...newAccount(), name: "Tomek" });
  await expect(tomek.getByRole("heading", { level: 1, name: "Moje listy" })).toBeVisible();
  const token = url.split("/").pop() ?? "";
  expect((await api(tomek).post(`/api/v1/invitations/${token}/accept`, {})).ok()).toBe(true);
  await tomek.goto(`/listy/${list.id}`);
  await add(tomek, "Chleb");
  await expect(page.getByText(/dodał\(a\) Tomek$/)).toBeVisible(LIVE);

  await tomek.goto("/konto");
  await saveName(tomek, "Tomasz");
  await expect(tomek.getByText("Imię zmienione")).toBeVisible();
  await expect(page.getByText(/dodał\(a\) Tomasz$/)).toBeVisible(LIVE);

  await page.goto(`/listy/${list.id}/uczestnicy`);
  await expect(page.getByText("Tomasz", { exact: true })).toBeVisible();
  await saveName(tomek, "Tomek B.");
  await expect(page.getByText("Tomek B.", { exact: true })).toBeVisible(LIVE);
  await tomekClient.close();
});

// T-061 AC5: stany SC-09 bez naruszeń axe; nagłówki ekranu.
test("SC-09 name form states have no axe violations", async ({ page }) => {
  await signUp(page, newAccount());
  await expect(page.getByRole("heading", { level: 1, name: "Moje listy" })).toBeVisible();
  await page.goto("/konto");
  await expect(page.getByRole("heading", { level: 1, name: "Konto" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Twoje dane" })).toBeVisible();
  const field = page.getByRole("textbox", { name: "Imię" });
  await expect(field).toHaveValue("Ania");
  await expectNoAxeViolations(page);

  await saveName(page, "");
  await expect(page.getByText("Wpisz imię")).toBeVisible();
  await expect(field).toBeFocused();
  await expectNoAxeViolations(page);

  await page.route("**/api/v1/me", (route) =>
    route.request().method() === "PATCH"
      ? route.fulfill({ status: 500, json: { error: { code: "internal" } } })
      : route.fallback(),
  );
  await saveName(page, "Anna");
  await expect(page.getByText("Nie udało się zapisać. Spróbuj ponownie.")).toBeVisible();
  await expectNoAxeViolations(page);
  await page.unroute("**/api/v1/me");

  await saveName(page, "Anna");
  await expect(page.getByText("Imię zmienione")).toBeVisible();
  await expectNoAxeViolations(page);

  await page.context().setOffline(true);
  await expect(page.getByRole("button", { name: "Zapisz imię" })).toHaveAttribute(
    "aria-disabled",
    "true",
    { timeout: 5_000 },
  );
  await expectNoAxeViolations(page);
});
