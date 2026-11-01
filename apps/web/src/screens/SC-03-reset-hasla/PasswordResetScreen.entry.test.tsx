import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { server } from "../../../test/msw-server";
import { renderApp, sessionIs } from "../../../test/render";
import { fillIn } from "../../../test/user";

const INVITATION = { token: "t".repeat(43), listName: "Dom" };
const INVITED = "Zaloguj się, żeby dołączyć do listy „Dom”.";

/** Na SC-03 pole wypełnione; „Wróć do logowania” → SC-01 z tym e-mailem i zaproszeniem. */
async function expectResetThenBack(user: ReturnType<typeof userEvent.setup>, email: string) {
  expect(await screen.findByRole("heading", { level: 1, name: "Reset hasła" })).toBeVisible();
  expect(screen.getByLabelText("E-mail")).toHaveValue(email);

  await user.click(screen.getByRole("link", { name: "Wróć do logowania" }));

  expect(await screen.findByRole("heading", { level: 1, name: "Zaloguj się" })).toBeVisible();
  expect(screen.getByLabelText("E-mail")).toHaveValue(email);
  expect(screen.getByText(INVITED)).toBeVisible();
}

// AC3 (WCAG 3.3.7, T-028): każdy link do SC-03 i z powrotem niesie e-mail i kontekst zaproszenia.
describe("SC-01 / SC-02 ↔ SC-03", () => {
  beforeEach(() => {
    sessionIs(null);
  });

  it("„Nie pamiętasz hasła?” on SC-01 carries the typed e-mail and the invitation", async () => {
    const user = userEvent.setup();
    renderApp({ pathname: "/logowanie", state: { invitation: INVITATION } });
    await fillIn(user, await screen.findByLabelText("E-mail"), "tomek@example.com");

    await user.click(screen.getByRole("link", { name: "Nie pamiętasz hasła?" }));

    await expectResetThenBack(user, "tomek@example.com");
  });

  it("„zresetuj hasło” under a taken e-mail on SC-02 carries the e-mail and the invitation", async () => {
    server.use(
      http.post("*/api/auth/sign-up/email", () =>
        HttpResponse.json({ error: { code: "email_taken" } }, { status: 409 }),
      ),
    );
    const user = userEvent.setup();
    renderApp({ pathname: "/rejestracja", state: { invitation: INVITATION } });
    await fillIn(user, await screen.findByRole("textbox", { name: /Imię/ }), "Tomek");
    await fillIn(user, screen.getByRole("textbox", { name: "E-mail" }), "tomek@example.com");
    await fillIn(user, screen.getByLabelText(/^Hasło/), "haslo-tomka-123");
    await user.click(screen.getByRole("checkbox", { name: /regulamin/ }));
    await user.click(screen.getByRole("checkbox", { name: /16 lat/ }));
    await user.click(screen.getByRole("button", { name: "Załóż konto" }));
    await waitFor(() => {
      expect(screen.getByRole("link", { name: "zresetuj hasło" })).toBeVisible();
    });

    await user.click(screen.getByRole("link", { name: "zresetuj hasło" }));

    await expectResetThenBack(user, "tomek@example.com");
  });
});
