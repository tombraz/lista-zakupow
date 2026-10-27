import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { server } from "../../../test/msw-server";
import { renderApp, sessionIs } from "../../../test/render";

const ANIA = { id: "u-1", name: "Ania", email: "ania@example.com" };

function signInAnswers(status: number, body: object) {
  const requests: unknown[] = [];
  server.use(
    http.post("*/api/auth/sign-in/email", async ({ request }) => {
      requests.push(await request.json());
      return HttpResponse.json(body, { status });
    }),
  );
  return requests;
}

async function signInWith(user: ReturnType<typeof userEvent.setup>, password = "dobre-haslo") {
  await user.type(screen.getByLabelText("E-mail"), "ania@example.com");
  await user.type(screen.getByLabelText("Hasło"), password);
  await user.click(screen.getByRole("button", { name: "Zaloguj się" }));
}

describe("SC-01 Logowanie", () => {
  beforeEach(() => {
    sessionIs(null);
  });

  it("starts with focus on „E-mail” and links to sign-up and the documents", async () => {
    renderApp("/logowanie");

    expect(await screen.findByRole("heading", { level: 1, name: "Zaloguj się" })).toBeVisible();
    expect(screen.getByLabelText("E-mail")).toHaveFocus();
    expect(screen.getByLabelText("E-mail")).toHaveAttribute("autocomplete", "email");
    expect(screen.getByLabelText("Hasło")).toHaveAttribute("autocomplete", "current-password");
    expect(screen.getByRole("link", { name: "Załóż konto" })).toHaveAttribute(
      "href",
      "/rejestracja",
    );
    expect(screen.getByRole("link", { name: "Regulamin i polityka prywatności" })).toHaveAttribute(
      "href",
      "/regulamin",
    );
  });

  it("asks for both fields before sending anything", async () => {
    const requests = signInAnswers(200, { user: ANIA });
    const user = userEvent.setup();
    renderApp("/logowanie");
    await screen.findByLabelText("E-mail");

    await user.click(screen.getByRole("button", { name: "Zaloguj się" }));

    expect(screen.getByLabelText("E-mail")).toHaveAccessibleDescription("Wpisz adres e-mail");
    expect(screen.getByLabelText("Hasło")).toHaveAccessibleDescription("Wpisz hasło");
    expect(screen.getByLabelText("E-mail")).toHaveFocus();
    expect(requests).toEqual([]);
  });

  it("after wrong credentials focuses the alert, clears the password and keeps the e-mail (AC7)", async () => {
    signInAnswers(401, { error: { code: "invalid_credentials" } });
    const user = userEvent.setup();
    renderApp("/logowanie");
    await screen.findByLabelText("E-mail");

    await signInWith(user);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Nieprawidłowy e-mail lub hasło.");
    expect(alert).toHaveFocus();
    expect(screen.getByLabelText("Hasło")).toHaveValue("");
    expect(screen.getByLabelText("E-mail")).toHaveValue("ania@example.com");
  });

  it("explains the attempt limit and a network failure (SEC1)", async () => {
    signInAnswers(429, { error: { code: "rate_limited" } });
    const user = userEvent.setup();
    renderApp("/logowanie");
    await screen.findByLabelText("E-mail");

    await signInWith(user);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Zbyt wiele prób logowania. Spróbuj ponownie za kilka minut albo zresetuj hasło.",
    );

    server.use(http.post("*/api/auth/sign-in/email", () => HttpResponse.error()));
    await signInWith(user);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Brak połączenia. Sprawdź internet i spróbuj ponownie.",
      );
    });
  });

  it("opens „Moje listy” after signing in (AC4)", async () => {
    const requests = signInAnswers(200, { user: ANIA });
    const user = userEvent.setup();
    const { router } = renderApp("/logowanie");
    await screen.findByLabelText("E-mail");
    sessionIs(ANIA);

    await signInWith(user);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/listy");
    });
    expect(requests).toEqual([{ email: "ania@example.com", password: "dobre-haslo" }]);
  });

  it("returns to the address the person came from (AC4)", async () => {
    signInAnswers(200, { user: ANIA });
    const user = userEvent.setup();
    const { router } = renderApp({ pathname: "/logowanie", state: { from: "/konto" } });
    await screen.findByLabelText("E-mail");
    sessionIs(ANIA);

    await signInWith(user);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/konto");
    });
  });
});
