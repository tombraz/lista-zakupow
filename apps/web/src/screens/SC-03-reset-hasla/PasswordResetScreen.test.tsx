import { act, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { heldResponse, type HeldResponse } from "../../../test/held";
import { server } from "../../../test/msw-server";
import { renderApp, sessionIs } from "../../../test/render";
import { fillIn } from "../../../test/user";

const SENT = (email: string) =>
  `Jeśli konto z adresem ${email} istnieje, wysłaliśmy na nie link. Link jest ważny 1 godzinę.`;
const LIMIT = "Zbyt wiele próśb o reset. Spróbuj ponownie za kilka minut.";
const NETWORK = "Brak połączenia. Sprawdź internet i spróbuj ponownie.";

type Answer = { status: number; body: object } | "network";

/** Odpowiedzi API na kolejne prośby (ostatnia powtarzana); zwraca wysłane treści. */
function resetAnswers(answers: Answer[], held?: HeldResponse) {
  const requests: unknown[] = [];
  server.use(
    http.post("*/api/auth/request-password-reset", async ({ request }) => {
      requests.push(await request.json());
      if (held) await held.released;
      const answer = answers[Math.min(requests.length, answers.length) - 1] ?? "network";
      if (answer === "network") return HttpResponse.error();
      return HttpResponse.json(answer.body, { status: answer.status });
    }),
  );
  return requests;
}

const OK: Answer = { status: 200, body: {} };
const RATE_LIMITED: Answer = { status: 429, body: { error: { code: "rate_limited" } } };

function sendButton() {
  return screen.getByRole("button", { name: "Wyślij link" });
}

describe("SC-03 Reset hasła, krok 1", () => {
  beforeEach(() => {
    sessionIs(null);
  });

  it("shows step 1 with the e-mail typed on SC-01 and focus on the field (Empty)", async () => {
    renderApp({ pathname: "/reset-hasla", state: { email: "ania@example.com" } });

    expect(await screen.findByRole("heading", { level: 1, name: "Reset hasła" })).toBeVisible();
    expect(
      screen.getByText("Podaj e-mail konta. Wyślemy link do ustawienia nowego hasła."),
    ).toBeVisible();
    const email = screen.getByLabelText("E-mail");
    expect(email).toHaveValue("ania@example.com");
    expect(email).toHaveAttribute("autocomplete", "email");
    expect(email).toHaveFocus();
    expect(sendButton()).toBeVisible();
  });

  it("keeps focus on the button while sending and announces success with the e-mail sent (AC4)", async () => {
    const held = heldResponse();
    const requests = resetAnswers([OK], held);
    const user = userEvent.setup();
    renderApp("/reset-hasla");
    await fillIn(user, await screen.findByLabelText("E-mail"), "ania@example.com");

    await user.click(sendButton());

    expect(sendButton()).toHaveAttribute("aria-disabled", "true");
    expect(sendButton()).toHaveFocus();
    // Zmiana pola w trakcie: komunikat mówi, dla jakiego adresu wysłano prośbę.
    await fillIn(user, screen.getByLabelText("E-mail"), "x");
    sendButton().focus();
    held.release();
    expect(await screen.findByRole("status")).toHaveTextContent(SENT("ania@example.com"));
    expect(sendButton()).toHaveFocus();
    expect(sendButton()).not.toHaveAttribute("aria-disabled");
    expect(screen.getByLabelText("E-mail")).toBeVisible();
    expect(requests).toEqual([{ email: "ania@example.com" }]);
  });

  it("explains the limit and a network failure, and clears them after a successful request (AC4)", async () => {
    resetAnswers([RATE_LIMITED, "network", OK]);
    const user = userEvent.setup();
    renderApp({ pathname: "/reset-hasla", state: { email: "ania@example.com" } });
    await screen.findByLabelText("E-mail");

    await user.click(sendButton());
    expect(await screen.findByRole("alert")).toHaveTextContent(LIMIT);
    expect(sendButton()).toHaveFocus();

    await user.click(sendButton());
    expect(await screen.findByText(NETWORK)).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent(NETWORK);

    await user.click(sendButton());
    expect(await screen.findByRole("status")).toHaveTextContent(SENT("ania@example.com"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("sends one request for a double click (AC5, T-020)", async () => {
    const held = heldResponse();
    const requests = resetAnswers([OK], held);
    renderApp({ pathname: "/reset-hasla", state: { email: "ania@example.com" } });
    await screen.findByLabelText("E-mail");

    act(() => {
      fireEvent.click(sendButton());
      fireEvent.click(sendButton());
    });
    held.release();

    expect(await screen.findByRole("status")).toBeVisible();
    expect(requests).toHaveLength(1);
  });

  it("asks for an e-mail before sending anything", async () => {
    const requests = resetAnswers([OK]);
    const user = userEvent.setup();
    renderApp("/reset-hasla");
    await screen.findByLabelText("E-mail");

    await user.click(sendButton());

    expect(screen.getByLabelText("E-mail")).toHaveAccessibleDescription(
      "Wpisz poprawny adres e-mail",
    );
    expect(screen.getByLabelText("E-mail")).toHaveFocus();
    expect(requests).toEqual([]);
  });
});
