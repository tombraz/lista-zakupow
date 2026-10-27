import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { server } from "../../../test/msw-server";
import { renderApp, sessionIs } from "../../../test/render";

const ANIA = { id: "u-1", name: "Ania", email: "ania@example.com" };

function signUpAnswers(status: number, body: object) {
  const requests: unknown[] = [];
  server.use(
    http.post("*/api/auth/sign-up/email", async ({ request }) => {
      requests.push(await request.json());
      return HttpResponse.json(body, { status });
    }),
  );
  return requests;
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Imię"), " Ania ");
  await user.type(screen.getByLabelText("E-mail"), "Ania@Example.com");
  await user.type(screen.getByLabelText("Hasło"), "dobre-haslo");
  await user.click(screen.getByRole("checkbox", { name: /Akceptuję regulamin/ }));
  await user.click(screen.getByRole("checkbox", { name: "Mam ukończone 16 lat." }));
}

describe("SC-02 Rejestracja", () => {
  beforeEach(() => {
    sessionIs(null);
  });

  it("starts with focus on „Imię” and links the consent to SC-04 in a new tab", async () => {
    renderApp("/rejestracja");

    expect(await screen.findByRole("heading", { level: 1, name: "Załóż konto" })).toBeVisible();
    expect(screen.getByLabelText("Imię")).toHaveFocus();
    expect(screen.getByLabelText("Imię")).toHaveAccessibleDescription(
      "Tak zobaczą Cię inni na wspólnych listach.",
    );
    expect(screen.getByLabelText("Hasło")).toHaveAccessibleDescription("Co najmniej 8 znaków.");
    const terms = screen.getByRole("link", { name: "regulamin" });
    expect(terms).toHaveAttribute("href", "/regulamin");
    expect(terms).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: "Zaloguj się" })).toHaveAttribute("href", "/logowanie");
  });

  it("shows every validation error at once with a focused summary (AC3)", async () => {
    const requests = signUpAnswers(200, { user: ANIA });
    const user = userEvent.setup();
    renderApp("/rejestracja");
    await screen.findByLabelText("Imię");

    await user.click(screen.getByRole("button", { name: "Załóż konto" }));

    const summary = screen.getByRole("alert");
    expect(summary).toHaveTextContent("Popraw 5 pól");
    expect(summary).toHaveFocus();
    expect(screen.getByLabelText("Imię")).toHaveAccessibleDescription(
      expect.stringContaining("Wpisz imię") as string,
    );
    expect(screen.getByLabelText("Imię")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("E-mail")).toHaveAccessibleDescription(
      "Wpisz poprawny adres e-mail",
    );
    expect(screen.getByLabelText("Hasło")).toHaveAccessibleDescription(
      expect.stringContaining("Hasło musi mieć co najmniej 8 znaków") as string,
    );
    expect(
      screen.getByRole("checkbox", { name: /Akceptuję regulamin/ }),
    ).toHaveAccessibleDescription("Zaakceptuj regulamin i politykę prywatności");
    expect(
      screen.getByRole("checkbox", { name: "Mam ukończone 16 lat." }),
    ).toHaveAccessibleDescription("Potwierdź, że masz ukończone 16 lat");
    expect(requests).toEqual([]);
  });

  it("links each summary entry to its field and uses the right plural form", async () => {
    const user = userEvent.setup();
    renderApp("/rejestracja");
    await user.type(await screen.findByLabelText("Imię"), "a".repeat(31));
    await user.type(screen.getByLabelText("E-mail"), "ania@example.com");
    await user.type(screen.getByLabelText("Hasło"), "dobre-haslo");
    await user.click(screen.getByRole("checkbox", { name: "Mam ukończone 16 lat." }));

    await user.click(screen.getByRole("button", { name: "Załóż konto" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Popraw 2 pola");
    expect(screen.getByLabelText("Imię")).toHaveAccessibleDescription(
      expect.stringContaining("Imię może mieć najwyżej 30 znaków") as string,
    );
    await user.click(screen.getByRole("link", { name: "Imię może mieć najwyżej 30 znaków" }));
    expect(screen.getByLabelText("Imię")).toHaveFocus();
  });

  it("sends trimmed data with both consents and opens „Moje listy” (AC1)", async () => {
    const requests = signUpAnswers(200, { user: ANIA });
    const user = userEvent.setup();
    const { router } = renderApp("/rejestracja");
    await screen.findByLabelText("Imię");
    await fillValidForm(user);
    sessionIs(ANIA);

    await user.click(screen.getByRole("button", { name: "Załóż konto" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/listy");
    });
    expect(requests).toEqual([
      {
        name: "Ania",
        email: "ania@example.com",
        password: "dobre-haslo",
        termsAccepted: true,
        ageConfirmed: true,
      },
    ]);
  });

  it("explains under the e-mail field that the address is taken, with sign-in and reset links (AC2)", async () => {
    signUpAnswers(409, { error: { code: "email_taken" } });
    const user = userEvent.setup();
    renderApp("/rejestracja");
    await screen.findByLabelText("Imię");
    await fillValidForm(user);

    await user.click(screen.getByRole("button", { name: "Załóż konto" }));

    const email = screen.getByLabelText("E-mail");
    await waitFor(() => {
      expect(email).toHaveAccessibleDescription(
        "Konto z tym adresem już istnieje. Zaloguj się albo zresetuj hasło.",
      );
    });
    expect(email).toHaveFocus();
    expect(screen.getByRole("link", { name: "zresetuj hasło" })).toHaveAttribute(
      "href",
      "/reset-hasla",
    );
    expect(screen.getAllByRole("link", { name: "Zaloguj się" })[0]).toHaveAttribute(
      "href",
      "/logowanie",
    );
  });

  it("shows the server's field errors the same way as its own (AC3)", async () => {
    signUpAnswers(400, { error: { code: "validation_failed", fields: { name: "too_long" } } });
    const user = userEvent.setup();
    renderApp("/rejestracja");
    await screen.findByLabelText("Imię");
    await fillValidForm(user);

    await user.click(screen.getByRole("button", { name: "Załóż konto" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Popraw 1 pole");
    expect(screen.getByLabelText("Imię")).toHaveAccessibleDescription(
      expect.stringContaining("Imię może mieć najwyżej 30 znaków") as string,
    );
  });

  it("explains the sign-up limit and a network failure", async () => {
    signUpAnswers(429, { error: { code: "rate_limited" } });
    const user = userEvent.setup();
    renderApp("/rejestracja");
    await screen.findByLabelText("Imię");
    await fillValidForm(user);

    await user.click(screen.getByRole("button", { name: "Załóż konto" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Zbyt wiele prób rejestracji. Spróbuj ponownie później.",
    );

    server.use(http.post("*/api/auth/sign-up/email", () => HttpResponse.error()));
    await user.click(screen.getByRole("button", { name: "Załóż konto" }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Brak połączenia. Sprawdź internet i spróbuj ponownie.",
      );
    });
  });
});
