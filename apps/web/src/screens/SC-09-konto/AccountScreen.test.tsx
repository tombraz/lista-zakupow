import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
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
