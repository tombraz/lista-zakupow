import type { Page } from "@playwright/test";
import { expect, expectNoAxeViolations, test } from "./fixtures";
import { add, api, NAME, NOTE, openNewList } from "./lists";

// J-03 (część T-006): dodanie, duplikat, edycja, usunięcie; skany axe stanów SC-06 (AC1–AC3, AC7, AC9).
test("J-03 adds, blocks a duplicate, edits and deletes items", async ({ page }) => {
  await openNewList(page, "Dom");
  await expect(
    page.getByText("Lista jest pusta. Dopisz pierwszą rzecz w polu na dole."),
  ).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByLabel(NAME).fill("Mleko");
  await page.getByLabel(NOTE).fill("2 l");
  await page.getByRole("button", { name: "Dodaj pozycję" }).click();
  await expect(page.getByRole("button", { name: "Edytuj Mleko" })).toBeVisible();
  await expect(page.getByText("2 l · dodał(a) Ania")).toBeVisible();
  await expect(page.getByLabel(NAME)).toBeFocused();
  await expect(page.getByLabel(NAME)).toHaveValue("");
  await expect(page.getByRole("status").filter({ hasText: "Dodano Mleko" })).toBeAttached();
  await expectNoAxeViolations(page);

  await add(page, "mleko");
  await expect(page.getByRole("alert")).toHaveText(
    "⚠„Mleko” jest już na liście. Pozycja nie została dodana.",
  );
  await expect(page.getByLabel(NAME)).toHaveValue("mleko");
  await expectNoAxeViolations(page);

  await add(page, "Mleko owsiane");
  await expect(page.getByRole("button", { name: "Edytuj Mleko owsiane" })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);

  const trigger = page.getByRole("button", { name: "Edytuj Mleko owsiane" });
  await trigger.click();
  const sheet = page.getByRole("dialog", { name: "Edytuj pozycję" });
  await expect(sheet.getByLabel("Nazwa")).toBeFocused();
  await expectNoAxeViolations(page);
  for (let press = 0; press < 6; press += 1) {
    await page.keyboard.press("Tab");
    expect(await sheet.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await sheet.getByLabel("Nazwa").fill("MLEKO");
  await sheet.getByRole("button", { name: "Zapisz" }).click();
  await expect(sheet.getByRole("alert")).toHaveText(
    "⚠Na liście jest już pozycja „Mleko”. Wybierz inną nazwę.",
  );
  await expectNoAxeViolations(page);
  await sheet.getByLabel("Nazwa").fill("Mleko owsiane");
  await sheet.getByLabel(NOTE).fill("1 l");
  await sheet.getByRole("button", { name: "Zapisz" }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByText("1 l · dodał(a) Ania")).toBeVisible();

  await trigger.click();
  await sheet.getByRole("button", { name: "Usuń pozycję" }).click();
  await expect(trigger).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edytuj Mleko" })).toBeFocused();
});

// AC7 (F-14): usunięcie w drugiej karcie wygrywa z edycją w otwartym arkuszu.
test("SC-06 shows that an item was deleted by someone else", async ({ page }) => {
  const list = await openNewList(page, "Dom");
  await add(page, "Chleb");
  await expect(page.getByRole("button", { name: "Edytuj Chleb" })).toBeVisible();
  const created = await page.request.get(`/api/v1/lists/${list.id}`);
  const [bread] = ((await created.json()) as { items: { id: string }[] }).items;

  await page.getByRole("button", { name: "Edytuj Chleb" }).click();
  const sheet = page.getByRole("dialog", { name: "Edytuj pozycję" });
  // Usunięcie przez innego klienta tej samej listy. Bez drugiej karty: otwarcie strony w trakcie
  // testu wstrzymuje API na Windows ~10 s (T-001, layers/web.md „Pułapki”); kartę sprawdza QA.
  const removed = await api(page).delete(`/api/v1/lists/${list.id}/items/${bread?.id ?? ""}`);
  expect(removed.status()).toBe(204);

  // T-009: usunięcie dociera na żywo, zanim ktokolwiek zapisze edycję (zapis po nim = 404,
  // test komponentu „Edycja usuniętej pozycji”).
  await expect(sheet.getByText("Ta pozycja została usunięta przez inną osobę.")).toBeVisible();
  await expectNoAxeViolations(page);
  await sheet.getByRole("button", { name: "Zamknij" }).click();
  await expect(page.getByRole("button", { name: "Edytuj Chleb" })).toHaveCount(0);
});

// Nie więcej żądań naraz niż połączeń w puli API (10): zapisy i tak czekają na blokadę listy,
// a nadmiar czeka na połączenie dłużej niż 3 s i dostaje 500 (T-031).
const PARALLEL_ADDS = 10;

/** `count` pozycji przez API, potem przeładowanie i czekanie, aż ekran pokaże wszystkie. */
async function addViaApi(page: Page, listId: string, count: number) {
  const url = `/api/v1/lists/${listId}/items`;
  for (let start = 0; start < count; start += PARALLEL_ADDS) {
    const responses = await Promise.all(
      Array.from({ length: Math.min(PARALLEL_ADDS, count - start) }, (_, index) =>
        api(page).post(url, { name: `Pozycja ${String(start + index)}` }),
      ),
    );
    expect(responses.map((response) => response.status())).toEqual(responses.map(() => 201));
  }
  await page.reload();
  await expect(page.getByText(`${String(count)} do kupienia`)).toBeVisible();
}

// AC5: limit 500 pozycji.
test("SC-06 at 500 items shows the limit and disables the AddBar", async ({ page }) => {
  // 500 żądań API i skan axe 500 wierszy trwają dłużej niż domyślne 30 s.
  test.setTimeout(120_000);
  const list = await openNewList(page, "Duża");
  await addViaApi(page, list.id, 500);

  await expect(
    page.getByText("Lista ma 500 pozycji — to limit. Usuń kupione albo niepotrzebne pozycje."),
  ).toBeVisible();
  await expect(page.getByLabel(NAME)).toBeDisabled();
  await expect(page.getByRole("button", { name: "Dodaj pozycję" })).toBeDisabled();
  await expectNoAxeViolations(page);
});

// T-023: własne dodanie 500. pozycji wyłącza pole z fokusem; fokus na ostrzeżeniu, nie na `body`.
test("SC-06 adding the 500th item moves focus to the limit warning (T-023)", async ({ page }) => {
  test.setTimeout(120_000);
  const list = await openNewList(page, "Prawie pełna");
  await addViaApi(page, list.id, 499);
  await expect(page.getByLabel(NAME)).toBeEnabled();

  await page.getByLabel(NAME).fill("Ostatnia");
  await page.keyboard.press("Enter");

  const limit = page.getByRole("status").filter({
    hasText: "Lista ma 500 pozycji — to limit. Usuń kupione albo niepotrzebne pozycje.",
  });
  await expect(limit).toBeFocused();
  await expect(page.getByLabel(NAME)).toBeDisabled();
});

// AC9 (WCAG 2.4.11): element z fokusem nie chowa się pod przyklejonym AddBar.
test("SC-06 keeps the focused item above the AddBar", async ({ page }) => {
  const list = await openNewList(page, "Długa");
  await addViaApi(page, list.id, 30);
  // AddBar jest nieaktywny, dopóki lista się nie wczyta.
  await expect(page.getByLabel(NAME)).toBeEnabled();

  await page.getByLabel(NAME).focus();
  await page.keyboard.press("Shift+Tab");

  const last = page.getByRole("list", { name: "Do kupienia" }).getByRole("button").last();
  await expect(last).toBeFocused();
  const focused = await last.boundingBox();
  const bar = await page.getByRole("form", { name: "Dodaj pozycję" }).boundingBox();
  expect(focused).not.toBeNull();
  expect(bar).not.toBeNull();
  expect((focused?.y ?? 0) + (focused?.height ?? 0)).toBeLessThanOrEqual(bar?.y ?? 0);
  await expectNoAxeViolations(page);
});
