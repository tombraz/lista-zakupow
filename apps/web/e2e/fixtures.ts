import { randomInt, randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test as base, type Page } from "@playwright/test";

/**
 * Każdy test jako osobny klient: własny adres w X-Forwarded-For (API ufa proxy 127.0.0.1,
 * e2e/server.ts), żeby limity per IP z MC-04 / MC-05 nie łączyły testów.
 */
export const test = base.extend({
  // Drugi argument fixture to `use` Playwrighta; inna nazwa, bo lint bierze `use` za hook Reacta.
  context: async ({ context }, provide) => {
    const ip = `10.${String(randomInt(256))}.${String(randomInt(256))}.${String(randomInt(1, 255))}`;
    await context.setExtraHTTPHeaders({ "x-forwarded-for": ip });
    await provide(context);
  },
});

export { expect };

/** Skan axe stanu ekranu (WCAG 2.2 AA); każde naruszenie oblewa test. */
export async function expectNoAxeViolations(page: Page) {
  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(scan.violations).toEqual([]);
}

export function newAccount() {
  return { name: "Ania", email: `ania-${randomUUID()}@example.com`, password: "dobre-haslo-1" };
}

export async function signUp(page: Page, account: ReturnType<typeof newAccount>) {
  await page.goto("/rejestracja");
  await page.getByLabel("Imię").fill(account.name);
  await page.getByLabel("E-mail").fill(account.email);
  await page.getByLabel("Hasło", { exact: true }).fill(account.password);
  await page.getByRole("checkbox", { name: /Akceptuję regulamin/ }).check();
  await page.getByRole("checkbox", { name: "Mam ukończone 16 lat." }).check();
  await page.getByRole("button", { name: "Załóż konto" }).click();
}
