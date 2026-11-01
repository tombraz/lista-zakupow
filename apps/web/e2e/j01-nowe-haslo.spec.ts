import { expect, expectNoAxeViolations, newAccount, signUp, test } from "./fixtures";
import { resetLinkFor } from "./mailpit";

const RESET_PASSWORD = "**/api/auth/reset-password";

// J-01, SC-03 krok 2 (T-054): prośba → mail w Mailpit → nowe hasło → logowanie nowym hasłem;
// ponowne użycie linku; axe w każdym stanie kroku 2 i na SC-01 z komunikatem.
test("J-01 sets a new password from the mail link", async ({ page }) => {
  const account = newAccount();
  await signUp(page, account);
  await expect(page).toHaveURL(/\/listy$/);

  await page.goto("/reset-hasla");
  await page.getByLabel("E-mail").fill(account.email);
  await page.getByRole("button", { name: "Wyślij link" }).click();
  await expect(page.getByRole("status")).toContainText(account.email);
  const link = await resetLinkFor(account.email);

  // AC3: krok 2 z fokusem w polu, token zdjęty z paska adresu.
  await page.goto(link);
  await expect(page.getByRole("heading", { level: 1, name: "Ustaw nowe hasło" })).toBeVisible();
  const password = page.getByLabel("Nowe hasło");
  await expect(password).toBeFocused();
  await expect(page).toHaveURL(/\/reset-hasla$/);
  await expectNoAxeViolations(page);

  // AC2: walidacja pod polem.
  await password.fill("krótkie");
  const save = page.getByRole("button", { name: "Zapisz hasło" });
  await save.click();
  await expect(page.getByText("Hasło musi mieć co najmniej 8 znaków")).toBeVisible();
  await expect(password).toBeFocused();
  await expectNoAxeViolations(page);

  // Error — sieć: formularz zostaje.
  const newPassword = "nowe hasło ąę 123";
  await password.fill(newPassword);
  await page.route(RESET_PASSWORD, (route) => route.abort("internetdisconnected"));
  await save.click();
  await expect(page.getByRole("alert")).toHaveText(
    /Brak połączenia\. Sprawdź internet i spróbuj ponownie\./,
  );
  await expectNoAxeViolations(page);
  await page.unroute(RESET_PASSWORD);

  // AC3: zapis → SC-01 z komunikatem; sesja tej przeglądarki zakończona (TH-10).
  await save.click();
  await expect(page.getByRole("heading", { level: 1, name: "Zaloguj się" })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText(/Hasło zmienione\. Zaloguj się nowym hasłem\./);
  await expect(page).toHaveURL(/\/logowanie$/);
  await expectNoAxeViolations(page);

  // AC1: stare hasło nie działa, nowe działa.
  await page.getByLabel("E-mail").fill(account.email);
  await page.getByLabel("Hasło", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Zaloguj się" }).click();
  await expect(page.getByRole("alert")).toHaveText(/Nieprawidłowy e-mail lub hasło\./);
  await page.getByLabel("Hasło", { exact: true }).fill(newPassword);
  await page.getByRole("button", { name: "Zaloguj się" }).click();
  await expect(page).toHaveURL(/\/listy$/);

  // AC4: ten sam link drugi raz → link nieważny → „Wyślij nowy link” → krok 1.
  await page.goto(link);
  await page.getByLabel("Nowe hasło").fill("inne haslo 456");
  await page.getByRole("button", { name: "Zapisz hasło" }).click();
  await expect(page.getByRole("alert")).toHaveText(/Ten link wygasł albo został już użyty\./);
  await expect(page.getByLabel("Nowe hasło")).toHaveCount(0);
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Wyślij nowy link" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Reset hasła" })).toBeFocused();
});
