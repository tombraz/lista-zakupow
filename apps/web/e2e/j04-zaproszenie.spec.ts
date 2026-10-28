import type { Page } from "@playwright/test";
import { expect, expectNoAxeViolations, newAccount, newClient, signUp, test } from "./fixtures";
import { api, openNewList } from "./lists";

const CREATE = "Utwórz link zaproszenia";

/** Ania tworzy link na SC-07 swojej listy; zwraca adres z pola linku. */
async function createInviteLink(page: Page) {
  await page.getByRole("button", { name: CREATE }).click();
  const box = page.getByRole("group", { name: /^Link jednorazowy, ważny do / }).first();
  await expect(box.getByRole("button", { name: "Kopiuj" })).toBeFocused();
  return box.getByRole("textbox").inputValue();
}

/** Żądania strony do innych originów niż aplikacja (TH-08: brak zasobów zewnętrznych). */
function foreignRequests(page: Page, appOrigin: string) {
  const foreign: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol.startsWith("http") && url.origin !== appOrigin) {
      foreign.push(request.url());
    }
  });
  return foreign;
}

// J-04: link → rejestracja drugiego konta → lista u obu → ponowne użycie linku (AC1–AC5, AC9,
// SEC1, SEC5).
test("J-04 invite link, sign-up from the link, shared list, reused link", async ({
  page,
  browser,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const list = await openNewList(page, "Dom");
  await page.getByRole("link", { name: "Uczestnicy" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Uczestnicy" })).toBeVisible();
  await expect(
    page.getByText("Nikt jeszcze nie dołączył. Utwórz link i wyślij go domownikowi."),
  ).toBeVisible();
  await expectNoAxeViolations(page);

  const url = await createInviteLink(page);
  expect(url).toMatch(/\/zaproszenie\/[A-Za-z0-9_-]{43}$/);
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Kopiuj" }).click();
  await expect(page.getByText("Link skopiowany")).toBeVisible();
  await expectNoAxeViolations(page);

  const tomekClient = await newClient(browser);
  const tomek = await tomekClient.newPage();
  const foreign = foreignRequests(tomek, new URL(url).origin);
  const landing = await tomek.goto(url);
  expect(landing?.headers()["referrer-policy"]).toBe("no-referrer");
  await expect(tomek.getByText("Ania zaprasza Cię do listy „Dom”.")).toBeVisible();
  await expect(
    tomek.getByRole("heading", { level: 1, name: "Zaproszenie do listy" }),
  ).toBeFocused();
  await expectNoAxeViolations(tomek);

  await tomek.getByRole("button", { name: "Załóż konto i dołącz" }).click();
  await expect(tomek.getByText("Po założeniu konta dołączysz do listy „Dom”.")).toBeVisible();
  await expectNoAxeViolations(tomek);
  await tomek.getByLabel("Imię").fill("Tomek");
  await tomek.getByLabel("E-mail").fill(newAccount().email);
  await tomek.getByLabel("Hasło", { exact: true }).fill("haslo-tomka-1");
  await tomek.getByRole("checkbox", { name: /Akceptuję regulamin/ }).check();
  await tomek.getByRole("checkbox", { name: "Mam ukończone 16 lat." }).check();
  await tomek.getByRole("button", { name: "Załóż konto" }).click();

  await expect(tomek.getByText("Dołączyłeś(-aś) do listy „Dom”.")).toBeVisible();
  await expect(tomek.getByRole("heading", { level: 1, name: "Dom" })).toBeVisible();
  expect(tomek.url()).toContain(`/listy/${list.id}`);
  await expectNoAxeViolations(tomek);
  // TH-08: SC-08 (adres z tokenem) zastąpiony w historii.
  await tomek.goBack();
  expect(tomek.url()).not.toContain("/zaproszenie/");
  await tomek.goto("/listy");
  await expect(tomek.getByRole("link", { name: /^Dom, udostępniona przez Ania/ })).toBeVisible();
  expect(foreign).toEqual([]);

  await page.reload();
  await expect(page.getByRole("button", { name: CREATE })).toBeVisible();
  await expect(page.getByRole("group", { name: /^Link jednorazowy/ })).toHaveCount(0);
  await page.goto("/listy");
  const card = page.getByRole("link", { name: /^Dom/ });
  await expect(card.getByText("T", { exact: true })).toBeVisible();

  // MC-02: ten sam link drugi raz (trzecia osoba) nie działa i nie zdradza listy.
  const olaClient = await newClient(browser);
  const ola = await olaClient.newPage();
  await ola.goto(url);
  await expect(ola.getByRole("heading", { level: 1, name: "Ten link nie działa" })).toBeFocused();
  await expect(ola.getByText(/Dom|Ania/)).toHaveCount(0);
  await expectNoAxeViolations(ola);
  await olaClient.close();
  await tomekClient.close();
});

// AC7: właściciel na własnym linku; unieważniony link (AC2, SEC1).
test("SC-08 own link and a revoked link", async ({ page }) => {
  const list = await openNewList(page, "Dom");
  const created = await api(page).post(`/api/v1/lists/${list.id}/invitations`, {});
  const own = (await created.json()) as { id: string; url: string };
  const revoked = (await (
    await api(page).post(`/api/v1/lists/${list.id}/invitations`, {})
  ).json()) as { id: string; url: string };

  await page.goto(new URL(own.url).pathname);
  await page.getByRole("button", { name: "Dołącz do listy" }).click();
  await expect(page.getByText("To Twoja lista — nie musisz dołączać.")).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole("link", { name: "Otwórz listę" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Dom" })).toBeVisible();

  await page.getByRole("link", { name: "Uczestnicy" }).click();
  // Najnowszy link na górze: to ten do unieważnienia.
  const box = page.getByRole("group", { name: /^Link jednorazowy/ }).first();
  await expect(box.getByRole("textbox")).toHaveValue(revoked.url);
  await box.getByRole("button", { name: "Unieważnij" }).click();
  await expect(page.getByRole("button", { name: CREATE })).toBeFocused();
  await expect(page.getByRole("group", { name: /^Link jednorazowy/ })).toHaveCount(1);

  await page.goto(new URL(revoked.url).pathname);
  await expect(page.getByRole("heading", { level: 1, name: "Ten link nie działa" })).toBeVisible();
});

// AC9: pozostałe stany SC-07 i SC-08 (odpowiedzi API podstawione w przeglądarce).
test("SC-07 and SC-08 states pass axe", async ({ page, browser }) => {
  const list = await openNewList(page, "Dom");
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: () => Promise.reject(new Error("denied")) },
    });
  });
  await page.route(`**/api/v1/lists/${list.id}`, async (route) => {
    const response = await route.fetch();
    const details = (await response.json()) as Record<string, unknown>;
    const members = Array.from({ length: 20 }, (_, index) => ({
      id: `u-${String(index)}`,
      name: `Osoba ${String(index)}`,
    }));
    await route.fulfill({ response, json: { ...details, members } });
  });
  await api(page).post(`/api/v1/lists/${list.id}/invitations`, {});
  await page.goto(`/listy/${list.id}/uczestnicy`);
  await expect(
    page.getByText("Lista ma 20 uczestników — to limit. Usuń kogoś, żeby zaprosić nową osobę."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: CREATE })).toBeDisabled();
  await page.getByRole("button", { name: "Kopiuj" }).click();
  await expect(page.getByText("Skopiuj link ręcznie.")).toBeVisible();
  await expectNoAxeViolations(page);

  const other = await newClient(browser);
  const visitor = await other.newPage();
  await signUp(visitor, { ...newAccount(), name: "Tomek" });
  await expect(visitor.getByRole("heading", { level: 1, name: "Moje listy" })).toBeVisible();
  const token = "x".repeat(43);
  const preview = { listName: "Dom", ownerName: "Ania" };
  await visitor.route(`**/api/v1/invitations/${token}`, (route) =>
    route.fulfill({ json: preview }),
  );
  for (const [error, text] of [
    [{ code: "limit_reached", limit: "participants" }, "Lista ma już 20 uczestników"],
    [{ code: "already_member", listId: list.id }, "Już jesteś na tej liście."],
  ] as const) {
    await visitor.route(`**/api/v1/invitations/${token}/accept`, (route) =>
      route.fulfill({ status: 409, json: { error } }),
    );
    await visitor.goto(`/zaproszenie/${token}`);
    await visitor.getByRole("button", { name: "Dołącz do listy" }).click();
    await expect(visitor.getByText(text)).toBeVisible();
    await expectNoAxeViolations(visitor);
  }
  await visitor.route(`**/api/v1/invitations/${token}`, (route) => route.abort());
  await visitor.goto(`/zaproszenie/${token}`);
  // Klient ponawia błędy sieci (queryClient.ts), więc komunikat po kilku próbach.
  await expect(
    visitor.getByText("Brak połączenia. Sprawdź internet i spróbuj ponownie."),
  ).toBeVisible({ timeout: 15_000 });
  await expectNoAxeViolations(visitor);
  await other.close();
});
