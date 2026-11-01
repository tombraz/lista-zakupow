import type { Page } from "@playwright/test";
import { expect, expectNoAxeViolations, newAccount, newClient, signUp, test } from "./fixtures";
import { api, openNewList } from "./lists";

const OFFLINE = "Brak połączenia. Zmiany nie są zapisywane.";
// F-15, architecture.md „Zmiany na żywo”: zerwanie widoczne w ≤ 10 s.
const SOON = { timeout: 10_000 };
// Powrót: nowe połączenie WebSocket. Na Windows nowe połączenie TCP z API czeka czasem ~10 s
// (w api.log upgrade 10 s po `online`, a GET po starym połączeniu od razu; „Pułapki” web.md,
// T-006), więc powrót ma zapas. Czasu powrotu AC nie określa.
const BACK = { timeout: 20_000 };

const banner = (page: Page) => page.getByRole("status").filter({ hasText: OFFLINE });

/** Ekran w stanie Offline: pasek, przycisk zapisu nieaktywny, axe bez naruszeń; potem powrót. */
async function checkOffline(page: Page, inactive: string) {
  await expect(page.getByRole("button", { name: inactive })).toBeVisible();
  await page.context().setOffline(true);
  await expect(banner(page)).toBeVisible(SOON);
  await expect(page.getByRole("button", { name: inactive })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await expectNoAxeViolations(page);
  await page.context().setOffline(false);
  await expect(banner(page)).toBeHidden(BACK);
}

// J-05 / F-15 (T-063 AC4, AC5): przerwa u jednej osoby, zmiany drugiej widoczne po powrocie.
test("F-15 after a break in the connection the list shows what the other person changed", async ({
  page,
  browser,
}) => {
  const list = await openNewList(page, "Dom");
  const created = await api(page).post(`/api/v1/lists/${list.id}/items`, { name: "Chleb" });
  expect(created.status()).toBe(201);
  const bread = (await created.json()) as { id: string };
  const invitation = await api(page).post(`/api/v1/lists/${list.id}/invitations`, {});
  expect(invitation.status()).toBe(201);
  const { url } = (await invitation.json()) as { url: string };

  const tomekClient = await newClient(browser);
  const tomek = await tomekClient.newPage();
  await signUp(tomek, { ...newAccount(), name: "Tomek" });
  await expect(tomek.getByRole("heading", { level: 1, name: "Moje listy" })).toBeVisible();
  const token = url.split("/").pop() ?? "";
  const accepted = await api(tomek).post(`/api/v1/invitations/${token}/accept`, {});
  expect(accepted.ok()).toBe(true);
  await tomek.goto(`/listy/${list.id}`);
  await expect(tomek.getByText("1 do kupienia")).toBeVisible();

  await tomekClient.setOffline(true);
  await expect(banner(tomek)).toBeVisible(SOON);
  await expect(tomek.getByRole("button", { name: "Dodaj pozycję" })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await expect(tomek.getByRole("button", { name: "Odhacz Chleb" })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await expectNoAxeViolations(tomek);

  // Ania w czasie przerwy: dodaje „Masło”, odhacza „Chleb”.
  const butter = await api(page).post(`/api/v1/lists/${list.id}/items`, { name: "Masło" });
  expect(butter.status()).toBe(201);
  const checked = await api(page).patch(`/api/v1/lists/${list.id}/items/${bread.id}`, {
    checked: true,
  });
  expect(checked.status()).toBe(200);
  await expect(tomek.getByRole("button", { name: "Edytuj Masło" })).toBeHidden();

  await tomekClient.setOffline(false);
  await expect(banner(tomek)).toBeHidden(BACK);
  await expect(tomek.getByRole("button", { name: "Edytuj Masło" })).toBeVisible(BACK);
  await expect(tomek.getByRole("button", { name: "Kupione (1)" })).toBeVisible(BACK);
  await expect(
    tomek.getByRole("status").filter({ hasText: "Połączenie przywrócone." }),
  ).toBeAttached();
  await tomekClient.close();
});

// T-063 AC2, AC5: stan Offline SC-05, SC-06, SC-07, SC-09 bez naruszeń axe; „Wyloguj się” działa.
test("F-15 every signed-in screen shows the offline state without axe violations", async ({
  page,
}) => {
  const list = await openNewList(page, "Dom");
  await checkOffline(page, "Dodaj pozycję");

  await page.goto(`/listy/${list.id}/uczestnicy`);
  await expect(page.getByRole("heading", { level: 1, name: "Uczestnicy" })).toBeVisible();
  await checkOffline(page, "Utwórz link zaproszenia");

  await page.goto("/listy");
  await expect(page.getByRole("link", { name: /Dom/ })).toBeVisible();
  await checkOffline(page, "+ Nowa lista");

  await page.goto("/konto");
  await expect(page.getByRole("heading", { level: 1, name: "Konto" })).toBeVisible();
  await page.context().setOffline(true);
  await expect(banner(page)).toBeVisible(SOON);
  await expectNoAxeViolations(page);
  await expect(page.getByRole("button", { name: "Wyloguj się" })).not.toHaveAttribute(
    "aria-disabled",
  );
});

// T-063 AC5: pasek przesuwa treść, nie zasłania jej, przy 320 px i 200% tekstu.
test("F-15 the offline banner pushes the content down at 320 px and 200% text", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await openNewList(page, "Zakupy na weekend");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Page.setFontSizes", { fontSizes: { standard: 32 } });
  await page.context().setOffline(true);
  await expect(banner(page)).toBeVisible(SOON);

  const box = async (selector: string) => {
    const found = await page.locator(selector).first().boundingBox();
    if (!found) throw new Error(`no box for ${selector}`);
    return found;
  };
  const header = await box("header");
  const bar = await banner(page).boundingBox();
  const main = await box("main");
  if (!bar) throw new Error("no banner box");
  expect(bar.y).toBeGreaterThanOrEqual(header.y + header.height - 1);
  expect(main.y).toBeGreaterThanOrEqual(bar.y + bar.height - 1);
  expect(bar.width).toBeLessThanOrEqual(320);
  const clipped = await banner(page).evaluate(
    (element) => element.scrollWidth > element.clientWidth,
  );
  expect(clipped).toBe(false);
  await expectNoAxeViolations(page);
});
