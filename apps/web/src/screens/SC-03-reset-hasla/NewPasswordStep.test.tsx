import { act, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { heldResponse, type HeldResponse } from "../../../test/held";
import { ANIA } from "../../../test/lists";
import { server } from "../../../test/msw-server";
import { renderApp, sessionIs } from "../../../test/render";
import { fillIn } from "../../../test/user";

const TOKEN = "pudfM2EPEemxQ6EP3xO0Lz9d";

const TOO_SHORT = "Hasło musi mieć co najmniej 8 znaków";
const CHANGED = "Hasło zmienione. Zaloguj się nowym hasłem.";
const INVALID = "Ten link wygasł albo został już użyty.";
const NETWORK = "Brak połączenia. Sprawdź internet i spróbuj ponownie.";
const OK: Answer = { status: 200, body: {} };
const INVALID_TOKEN: Answer = { status: 400, body: { error: { code: "invalid_token" } } };

type Answer = { status: number; body: object } | "network";

/** Odpowiedzi API na kolejne zapisy hasła (ostatnia powtarzana); zwraca wysłane treści. */
function resetAnswers(answers: Answer[], held?: HeldResponse) {
  const requests: unknown[] = [];
  server.use(
    http.post("*/api/auth/reset-password", async ({ request }) => {
      requests.push(await request.json());
      if (held) await held.released;
      const answer = answers[Math.min(requests.length, answers.length) - 1] ?? "network";
      if (answer === "network") return HttpResponse.error();
      return HttpResponse.json(answer.body, { status: answer.status });
    }),
  );
  return requests;
}

function saveButton() {
  return screen.getByRole("button", { name: "Zapisz hasło" });
}

function passwordField() {
  return screen.getByLabelText("Nowe hasło");
}

describe("SC-03 Reset hasła, krok 2", () => {
  beforeEach(() => {
    sessionIs(null);
  });

  it("opens step 2 from the mail link with focus in the new password field and the token out of the address (AC3)", async () => {
    const { router } = renderApp(`/reset-hasla?token=${TOKEN}`);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Ustaw nowe hasło" }),
    ).toBeVisible();
    const field = passwordField();
    expect(field).toHaveFocus();
    expect(field).toHaveAttribute("type", "password");
    expect(field).toHaveAttribute("autocomplete", "new-password");
    expect(field).toHaveAccessibleDescription("Co najmniej 8 znaków.");
    expect(screen.getByRole("button", { name: "Pokaż" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Zapisz hasło" })).toBeVisible();
    expect(router.state.location.pathname).toBe("/reset-hasla");
    expect(router.state.location.search).toBe("");
  });

  it("stays on step 2 after a reload (token kept in the navigation state, not in the address)", async () => {
    const requests = resetAnswers([OK]);
    const user = userEvent.setup();
    renderApp({ pathname: "/reset-hasla", state: { resetToken: TOKEN } });
    await fillIn(user, await screen.findByLabelText("Nowe hasło"), "nowe haslo 123");

    await user.click(saveButton());

    expect(await screen.findByText(CHANGED)).toBeVisible();

    expect(screen.getByRole("status")).toHaveTextContent(CHANGED);
    expect(requests).toEqual([{ token: TOKEN, newPassword: "nowe haslo 123" }]);
  });

  it("explains a too short password under the field, with focus on it, without a request (AC2)", async () => {
    const requests = resetAnswers([{ status: 200, body: {} }]);
    const user = userEvent.setup();
    renderApp(`/reset-hasla?token=${TOKEN}`);
    await fillIn(user, await screen.findByLabelText("Nowe hasło"), "krótkie");

    await user.click(saveButton());

    expect(passwordField()).toHaveAccessibleDescription(`Co najmniej 8 znaków. ${TOO_SHORT}`);
    expect(passwordField()).toHaveAttribute("aria-invalid", "true");
    expect(passwordField()).toHaveFocus();
    expect(requests).toEqual([]);
  });

  it("saves the password and replaces the page with SC-01 and its success message (AC3)", async () => {
    const held = heldResponse();
    const requests = resetAnswers([OK], held);
    const user = userEvent.setup();
    const { router } = renderApp(["/logowanie", `/reset-hasla?token=${TOKEN}`]);
    await fillIn(user, await screen.findByLabelText("Nowe hasło"), "nowe hasło ąę");

    await user.click(saveButton());

    expect(saveButton()).toHaveAttribute("aria-disabled", "true");
    expect(saveButton()).toHaveFocus();
    held.release();
    expect(await screen.findByText(CHANGED)).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(CHANGED);
    expect(screen.getByRole("heading", { level: 1, name: "Zaloguj się" })).toBeVisible();
    expect(requests).toEqual([{ token: TOKEN, newPassword: "nowe hasło ąę" }]);
    expect(router.state.location.pathname).toBe("/logowanie");
    // `replace`: wstecz nie wraca do strony z tokenem.
    await router.navigate(-1);
    expect(router.state.location.pathname).toBe("/logowanie");
    expect(JSON.stringify(router.state.location)).not.toContain(TOKEN);
  });

  it("replaces the form with the invalid link message; „Wyślij nowy link” opens step 1 with focus on the heading (AC4)", async () => {
    resetAnswers([INVALID_TOKEN]);
    const user = userEvent.setup();
    const { router } = renderApp(`/reset-hasla?token=${TOKEN}`);
    await fillIn(user, await screen.findByLabelText("Nowe hasło"), "nowe haslo 123");

    await user.click(saveButton());

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(INVALID);
    expect(alert).toHaveFocus();
    expect(screen.queryByLabelText("Nowe hasło")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Zapisz hasło" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Wyślij nowy link" }));

    const heading = await screen.findByRole("heading", { level: 1, name: "Reset hasła" });
    expect(heading).toHaveFocus();
    expect(screen.getByLabelText("E-mail")).toHaveValue("");
    expect(JSON.stringify(router.state.location)).not.toContain(TOKEN);
  });

  it("explains a network failure, keeps the form and focus, and lets the user retry (Error — sieć)", async () => {
    const requests = resetAnswers(["network", OK]);
    const user = userEvent.setup();
    renderApp(`/reset-hasla?token=${TOKEN}`);
    await fillIn(user, await screen.findByLabelText("Nowe hasło"), "nowe haslo 123");

    await user.click(saveButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(NETWORK);
    expect(saveButton()).toHaveFocus();
    expect(passwordField()).toHaveValue("nowe haslo 123");
    await user.click(saveButton());
    expect(await screen.findByText(CHANGED)).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(CHANGED);
    expect(requests).toHaveLength(2);
  });

  it("shows the API's password validation error under the field (AC2)", async () => {
    resetAnswers([
      {
        status: 400,
        body: { error: { code: "validation_failed", fields: { newPassword: "too_short" } } },
      },
    ]);
    const user = userEvent.setup();
    renderApp(`/reset-hasla?token=${TOKEN}`);
    await fillIn(user, await screen.findByLabelText("Nowe hasło"), "nowe haslo 123");

    await user.click(saveButton());

    await vi.waitFor(() => {
      expect(passwordField()).toHaveAccessibleDescription(`Co najmniej 8 znaków. ${TOO_SHORT}`);
    });
    expect(passwordField()).toHaveFocus();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("explains a password longer than 128 characters (AC2)", async () => {
    const requests = resetAnswers([OK]);
    const user = userEvent.setup();
    renderApp(`/reset-hasla?token=${TOKEN}`);
    await fillIn(user, await screen.findByLabelText("Nowe hasło"), "a".repeat(129));

    await user.click(saveButton());

    expect(passwordField()).toHaveAccessibleDescription(
      "Co najmniej 8 znaków. Hasło może mieć najwyżej 128 znaków",
    );
    expect(requests).toEqual([]);
  });

  // Link w mailu kończy się kropką zdania (Copy `mail.body`); część programów pocztowych
  // dołącza ją do adresu (QA T-053 #2). Token Better Auth ma tylko litery i cyfry.
  it("ignores the sentence's full stop that a mail client glued to the link", async () => {
    const requests = resetAnswers([OK]);
    const user = userEvent.setup();
    renderApp(`/reset-hasla?token=${TOKEN}.`);
    await fillIn(user, await screen.findByLabelText("Nowe hasło"), "nowe haslo 123");

    await user.click(saveButton());

    expect(await screen.findByText(CHANGED)).toBeVisible();

    expect(screen.getByRole("status")).toHaveTextContent(CHANGED);
    expect(requests).toEqual([{ token: TOKEN, newPassword: "nowe haslo 123" }]);
  });

  it("treats a link with an empty token as invalid", async () => {
    const requests = resetAnswers([OK]);
    const user = userEvent.setup();
    renderApp("/reset-hasla?token=");
    await fillIn(user, await screen.findByLabelText("Nowe hasło"), "nowe haslo 123");

    await user.click(saveButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(INVALID);
    expect(requests).toEqual([]);
  });

  // T-020: drugi klik przed przerysowaniem nie wysyła drugiego żądania (drugie dostałoby
  // `invalid_token` i ekran pokazałby nieważny link mimo zapisanego hasła).
  it("sends one request for a double click", async () => {
    const held = heldResponse();
    const requests = resetAnswers([OK, INVALID_TOKEN], held);
    const user = userEvent.setup();
    renderApp(`/reset-hasla?token=${TOKEN}`);
    await fillIn(user, await screen.findByLabelText("Nowe hasło"), "nowe haslo 123");

    act(() => {
      fireEvent.click(saveButton());
      fireEvent.click(saveButton());
    });
    held.release();

    expect(await screen.findByText(CHANGED)).toBeVisible();

    expect(screen.getByRole("status")).toHaveTextContent(CHANGED);
    expect(requests).toHaveLength(1);
  });

  // Link otwarty w przeglądarce z sesją tego (albo innego) konta: reset usunął sesje konta,
  // więc klient też kończy sesję, a SC-01 nie przekierowuje na SC-05.
  it("ends the session in this browser and shows SC-01 with the message", async () => {
    sessionIs(ANIA);
    resetAnswers([OK]);
    const user = userEvent.setup();
    const { router } = renderApp(`/reset-hasla?token=${TOKEN}`);
    await fillIn(user, await screen.findByLabelText("Nowe hasło"), "nowe haslo 123");

    await user.click(saveButton());

    expect(await screen.findByText(CHANGED)).toBeVisible();

    expect(screen.getByRole("status")).toHaveTextContent(CHANGED);
    expect(router.state.location.pathname).toBe("/logowanie");
  });
});
