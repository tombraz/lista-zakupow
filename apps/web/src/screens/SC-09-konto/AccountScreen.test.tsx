import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { server } from "../../../test/msw-server";
import { renderApp, sessionIs } from "../../../test/render";

const ANIA = { id: "u-1", name: "Ania", email: "ania@example.com" };

async function logOut() {
  const user = userEvent.setup();
  renderApp("/konto");
  await user.click(await screen.findByRole("button", { name: "Wyloguj się" }));
}

// QA round 1, #4: komunikat błędu wylogowania zależy od kodu błędu, nie zawsze „Brak połączenia”.
describe("SC-09 Konto: failed sign-out", () => {
  beforeEach(() => {
    sessionIs(ANIA);
  });

  it("says the connection is down when the request does not reach the server", async () => {
    server.use(http.post("*/api/auth/sign-out", () => HttpResponse.error()));

    await logOut();

    expect(
      await screen.findByText("Brak połączenia. Sprawdź internet i spróbuj ponownie."),
    ).toBeVisible();
  });

  it("says the sign-out failed when the server answers with an error", async () => {
    server.use(
      http.post("*/api/auth/sign-out", () =>
        HttpResponse.json({ error: { code: "internal" } }, { status: 500 }),
      ),
    );

    await logOut();

    expect(await screen.findByText("Nie udało się wylogować. Spróbuj ponownie.")).toBeVisible();
    expect(screen.queryByText(/Brak połączenia/)).toBeNull();
  });
});

// T-015: w czasie wylogowania przycisk zostaje fokusowalny (aria-disabled zamiast disabled).
describe("SC-09 Konto: signing out", () => {
  beforeEach(() => {
    sessionIs(ANIA);
  });

  it("keeps focus on „Wyloguj się” while signing out", async () => {
    server.use(
      http.post("*/api/auth/sign-out", async () => {
        await delay("infinite");
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderApp("/konto");
    const logout = await screen.findByRole("button", { name: "Wyloguj się" });

    logout.focus();
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(logout).toHaveAttribute("aria-busy", "true");
    });
    expect(logout).toHaveAttribute("aria-disabled", "true");
    expect(logout).not.toBeDisabled();
    expect(logout).toHaveFocus();
  });
});
