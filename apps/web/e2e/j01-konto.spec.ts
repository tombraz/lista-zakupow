import { expect, expectNoAxeViolations, newAccount, signUp, test } from "./fixtures";

// J-01: rejestracja → „Moje listy” → konto → wylogowanie → logowanie (AC4–AC7, SEC5).
test("J-01 registers, signs out and signs in again", async ({ page, context }) => {
  const account = newAccount();

  await page.goto("/listy");
  await expect(page).toHaveURL(/\/logowanie$/);
  await expect(page.getByRole("heading", { level: 1, name: "Zaloguj się" })).toBeVisible();
  await expect(page.getByLabel("E-mail")).toBeFocused();
  await expectNoAxeViolations(page);

  await page.getByRole("link", { name: "Załóż konto" }).click();
  await expect(page.getByLabel("Imię")).toBeFocused();
  await expectNoAxeViolations(page);

  await page.getByRole("button", { name: "Załóż konto" }).click();
  await expect(page.getByRole("alert")).toContainText("Popraw 5 pól");
  await expect(page.getByRole("alert")).toBeFocused();
  await expectNoAxeViolations(page);

  await signUp(page, account);
  await expect(page.getByRole("heading", { level: 1, name: "Moje listy" })).toBeVisible();
  await expect(page).toHaveURL(/\/listy$/);

  // SEC5 (TH-16): sesja tylko w ciasteczku HttpOnly — niewidoczna dla JavaScriptu.
  const session = (await context.cookies()).find((cookie) => cookie.name.includes("session_token"));
  expect(session?.httpOnly).toBe(true);
  expect(session?.sameSite).toBe("Lax");
  const visibleToScript = await page.evaluate(() => ({
    cookie: document.cookie,
    // Test sprawdza właśnie, że w magazynach przeglądarki nie ma sesji.
    // eslint-disable-next-line no-restricted-properties
    local: JSON.stringify(window.localStorage),
    // eslint-disable-next-line no-restricted-properties
    session: JSON.stringify(window.sessionStorage),
  }));
  expect(visibleToScript.cookie).not.toContain("session_token");
  expect(visibleToScript.local).not.toContain(session?.value.split(".")[0] ?? "");
  expect(visibleToScript.session).not.toContain(session?.value.split(".")[0] ?? "");
  expect(visibleToScript.local).toBe("{}");
  expect(visibleToScript.session).toBe("{}");

  await page.getByRole("link", { name: "Konto" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Konto" })).toBeVisible();
  await expect(page.getByText(account.email)).toBeVisible();
  await expect(page.getByText(account.name, { exact: true })).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByRole("button", { name: "Wyloguj się" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Zaloguj się" })).toBeVisible();
  await page.goto("/listy");
  await expect(page).toHaveURL(/\/logowanie$/);

  await page.getByLabel("E-mail").fill(account.email);
  await page.getByLabel("Hasło", { exact: true }).fill("zle-haslo-1");
  await page.getByRole("button", { name: "Zaloguj się" }).click();
  await expect(page.getByRole("alert")).toHaveText(/Nieprawidłowy e-mail lub hasło\./);
  await expect(page.getByRole("alert")).toBeFocused();
  await expect(page.getByLabel("Hasło", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("E-mail")).toHaveValue(account.email);
  await expectNoAxeViolations(page);

  await page.getByLabel("Hasło", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Zaloguj się" }).click();
  await expect(page).toHaveURL(/\/listy$/);
});

test("SC-02 shows a taken e-mail and SC-04 opens without signing in (AC2, AC7)", async ({
  page,
  browser,
}) => {
  const account = newAccount();
  const other = await browser.newContext();
  await signUp(await other.newPage(), account);
  await other.close();

  await signUp(page, account);

  await expect(
    page.getByText("Konto z tym adresem już istnieje. Zaloguj się albo zresetuj hasło."),
  ).toBeVisible();
  await expect(page.getByLabel("E-mail")).toBeFocused();
  await expectNoAxeViolations(page);

  await page.goto("/regulamin");
  await expect(
    page.getByRole("heading", { level: 1, name: "Regulamin i polityka prywatności" }),
  ).toBeVisible();
  await expectNoAxeViolations(page);
});
