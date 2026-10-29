import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../test/msw-server";
import { renderApp, sessionIs } from "../test/render";
import { fillIn } from "../test/user";

const ANIA = { id: "u-1", name: "Ania", email: "ania@example.com" };

describe("routes (AC6)", () => {
  for (const path of ["/listy", "/konto", "/", "/nieznany/adres"]) {
    it(`sends an anonymous person from ${path} to SC-01`, async () => {
      sessionIs(null);

      const { router } = renderApp(path);

      expect(await screen.findByRole("heading", { level: 1, name: "Zaloguj się" })).toBeVisible();
      expect(router.state.location.pathname).toBe("/logowanie");
    });
  }

  for (const path of ["/logowanie", "/rejestracja", "/regulamin"]) {
    it(`keeps an anonymous person on the public ${path}`, async () => {
      sessionIs(null);

      const { router } = renderApp(path);

      expect(await screen.findByRole("heading", { level: 1 })).toBeVisible();
      expect(router.state.location.pathname).toBe(path);
    });
  }

  for (const path of ["/logowanie", "/rejestracja"]) {
    it(`sends a signed-in person from ${path} to „Moje listy”`, async () => {
      sessionIs(ANIA);

      const { router } = renderApp(path);

      expect(await screen.findByRole("heading", { level: 1, name: "Moje listy" })).toBeVisible();
      expect(router.state.location.pathname).toBe("/listy");
    });
  }

  it("brings the person back to the protected address after signing in", async () => {
    sessionIs(null);
    server.use(http.post("*/api/auth/sign-in/email", () => HttpResponse.json({ user: ANIA })));
    const user = userEvent.setup();
    const { router } = renderApp("/konto");
    await fillIn(user, await screen.findByLabelText("E-mail"), ANIA.email);
    await fillIn(user, screen.getByLabelText("Hasło"), "dobre-haslo");
    sessionIs(ANIA);

    await user.click(screen.getByRole("button", { name: "Zaloguj się" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/konto");
    });
  });
});
