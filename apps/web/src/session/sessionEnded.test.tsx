import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { aList, ANIA, apiError, listsAre } from "../../test/lists";
import { liveServer } from "../../test/live";
import { server } from "../../test/msw-server";
import { renderApp, sessionIs } from "../../test/render";
import { fillIn } from "../../test/user";

const UNAUTHENTICATED = { code: "unauthenticated" };

// T-018: sesja wygasła albo wylogowana w innej karcie (T-004 AC6, SC-05 „niezalogowany → SC-01”).
describe("session ended while signed in", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends the person to SC-01 when an API read answers 401, and back after signing in (AC1)", async () => {
    sessionIs(ANIA);
    server.use(http.get("*/api/v1/lists", () => apiError(401, UNAUTHENTICATED)));
    server.use(http.post("*/api/auth/sign-in/email", () => HttpResponse.json({ user: ANIA })));
    const user = userEvent.setup();
    const { router } = renderApp("/listy");

    expect(await screen.findByRole("heading", { level: 1, name: "Zaloguj się" })).toBeVisible();
    expect(router.state.location.pathname).toBe("/logowanie");

    listsAre([aList({ name: "Dom" })]);
    await fillIn(user, screen.getByLabelText("E-mail"), ANIA.email);
    await fillIn(user, screen.getByLabelText("Hasło"), "dobre-haslo");
    await user.click(screen.getByRole("button", { name: "Zaloguj się" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Moje listy" })).toBeVisible();
    expect(router.state.location.pathname).toBe("/listy");
    expect(await screen.findByRole("link", { name: /Dom/ })).toBeVisible();
  });

  it("sends the person to SC-01 when a save answers 401 (AC1)", async () => {
    sessionIs(ANIA);
    listsAre([]);
    server.use(http.post("*/api/v1/lists", () => apiError(401, UNAUTHENTICATED)));
    const user = userEvent.setup();
    const { router } = renderApp("/listy");

    await user.click(await screen.findByRole("button", { name: "Utwórz pierwszą listę" }));
    await user.type(screen.getByRole("textbox", { name: "Nazwa listy" }), "Zakupy{Enter}");

    expect(await screen.findByRole("heading", { level: 1, name: "Zaloguj się" })).toBeVisible();
    expect(router.state.location.pathname).toBe("/logowanie");
  });

  it("signed out in another tab: the dropped live connection leads to SC-01 and is not retried (AC2)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["setTimeout", "clearTimeout"] });
    sessionIs(ANIA);
    listsAre([aList({ name: "Dom" })]);
    const live = liveServer();
    const { router } = renderApp("/listy");
    await screen.findByRole("heading", { level: 1, name: "Moje listy" });
    await waitFor(() => {
      expect(live.connections()).toBe(1);
    });

    // Wylogowanie w innej karcie: API zamyka połączenia tej sesji (TH-17), sesji już nie ma.
    sessionIs(null);
    live.dropAll();

    expect(await screen.findByRole("heading", { level: 1, name: "Zaloguj się" })).toBeVisible();
    expect(router.state.location.pathname).toBe("/logowanie");
    await act(() => vi.advanceTimersByTimeAsync(15_000));
    expect(live.connections()).toBe(1);
  });
});
