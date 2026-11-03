import { randomUUID } from "node:crypto";
import { expect, expectNoAxeViolations, test } from "./fixtures";

const REQUEST_RESET = "**/api/auth/request-password-reset";

// J-01, SC-03 krok 1 (T-053): SC-01 → SC-03 z e-mailem → sukces, limit, brak sieci; axe w każdym.
test("J-01 asks for a password reset link", async ({ page }) => {
  const email = `ania-${randomUUID()}@example.com`;
  let requests = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/auth/request-password-reset")) requests += 1;
  });

  await page.goto("/logowanie");
  await page.getByLabel("E-mail").fill(email);
  await page.getByRole("link", { name: "Nie pamiętasz hasła?" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Reset hasła" })).toBeVisible();
  await expect(page.getByLabel("E-mail")).toHaveValue(email);
  await expect(page.getByLabel("E-mail")).toBeFocused();
  await expectNoAxeViolations(page);

  // AC5 (T-020): podwójne kliknięcie to jedna prośba.
  const send = page.getByRole("button", { name: "Wyślij link" });
  await send.dblclick();
  await expect(page.getByRole("status")).toContainText(
    `Jeśli konto z adresem ${email} istnieje, wysłaliśmy na nie link. Link jest ważny 1 godzinę.`,
  );
  await expect(send).toBeFocused();
  expect(requests).toBe(1);
  await expectNoAxeViolations(page);

  // MC-04: po 3 prośbach dla adresu kolejna jest odrzucana.
  for (let attempt = 2; attempt <= 3; attempt += 1) {
    await send.click();
    await expect.poll(() => requests).toBe(attempt);
    await expect(send).not.toHaveAttribute("aria-disabled");
  }
  await send.click();
  await expect(page.getByRole("alert")).toHaveText(
    /Zbyt wiele próśb o reset\. Spróbuj ponownie za kilka minut\./,
  );
  await expect(page.getByRole("status")).toBeEmpty();
  await expectNoAxeViolations(page);

  await page.route(REQUEST_RESET, (route) => route.abort("internetdisconnected"));
  await send.click();
  await expect(page.getByRole("alert")).toHaveText(
    /Brak połączenia\. Sprawdź internet i spróbuj ponownie\./,
  );
  await expect(send).toBeFocused();
  await expectNoAxeViolations(page);
});
