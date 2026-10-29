import type { Me } from "@lista/shared";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { defaultScheduler, notifyManager } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { aList, apiError, detailsOf, TOMEK } from "../../../test/lists";
import { server } from "../../../test/msw-server";
import { renderApp } from "../../../test/render";

const TOKEN = "t".repeat(43);
const PAGE = `/zaproszenie/${TOKEN}`;
const TOMEK_ME: Me = { ...TOMEK, email: "tomek@example.com" };

/** Anonim do chwili zalogowania lub rejestracji; potem `/api/v1/me` zwraca Tomka. */
function anonymousUntilSignedIn() {
  const session = { user: null as Me | null };
  server.use(
    http.get("*/api/v1/me", () =>
      session.user ? HttpResponse.json(session.user) : apiError(401, { code: "unauthenticated" }),
    ),
    http.post("*/api/auth/sign-in/email", () => {
      session.user = TOMEK_ME;
      return HttpResponse.json({ user: TOMEK_ME });
    }),
  );
  return session;
}

/** Ważny link do „Dom” Ani i lista, którą Tomek zobaczy po dołączeniu. */
function inviteToDom() {
  const list = aList({ name: "Dom", role: "participant" });
  const accepts = { count: 0 };
  server.use(
    http.get(`*/api/v1/invitations/${TOKEN}`, () =>
      HttpResponse.json({ listName: "Dom", ownerName: "Ania" }),
    ),
    http.post(`*/api/v1/invitations/${TOKEN}/accept`, () => {
      accepts.count += 1;
      return HttpResponse.json({ listId: list.id });
    }),
    http.get(`*/api/v1/lists/${list.id}`, () => HttpResponse.json(detailsOf(list))),
    http.get("*/api/v1/lists", () => HttpResponse.json([list])),
  );
  return { list, accepts };
}

async function fillSignUp(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole("textbox", { name: /Imię/ }), "Tomek");
  await user.type(screen.getByLabelText(/^Hasło/), "haslo-tomka-123");
  await user.click(screen.getByRole("checkbox", { name: /regulamin/ }));
  await user.click(screen.getByRole("checkbox", { name: /16 lat/ }));
}

// AC5 (F-01, F-12): z SC-08 przez logowanie albo rejestrację — od razu na udostępnioną listę.
describe("SC-08 → SC-01 / SC-02 → the shared list", () => {
  it("sign in: SC-01 says why, then joins automatically and the link leaves history", async () => {
    const user = userEvent.setup();
    anonymousUntilSignedIn();
    const { list, accepts } = inviteToDom();
    const { router } = renderApp(["/regulamin", PAGE]);

    await user.click(await screen.findByRole("button", { name: "Mam konto — zaloguj się" }));

    expect(await screen.findByText("Zaloguj się, żeby dołączyć do listy „Dom”.")).toBeVisible();
    await user.type(screen.getByRole("textbox", { name: "E-mail" }), TOMEK_ME.email);
    await user.type(screen.getByLabelText(/^Hasło/), "haslo-tomka-123");
    await user.click(screen.getByRole("button", { name: "Zaloguj się" }));

    expect(await screen.findByText("Dołączyłeś(-aś) do listy „Dom”.")).toBeVisible();
    expect(accepts.count).toBe(1);
    expect(router.state.location.pathname).toBe(`/listy/${list.id}`);
    await router.navigate(-1);
    expect(router.state.location.pathname).toBe("/regulamin");
  });

  it("SC-01 → Załóż konto keeps the invitation and the typed e-mail (3.3.7)", async () => {
    const user = userEvent.setup();
    anonymousUntilSignedIn();
    inviteToDom();
    renderApp(PAGE);

    await user.click(await screen.findByRole("button", { name: "Mam konto — zaloguj się" }));
    await user.type(await screen.findByRole("textbox", { name: "E-mail" }), "tomek@example.com");
    await user.click(screen.getByRole("link", { name: "Załóż konto" }));

    expect(await screen.findByText("Po założeniu konta dołączysz do listy „Dom”.")).toBeVisible();
    expect(screen.getByRole("textbox", { name: "E-mail" })).toHaveValue("tomek@example.com");
  });

  it("sign up: the request carries the token and the new account lands on the list", async () => {
    const user = userEvent.setup();
    anonymousUntilSignedIn();
    const { list, accepts } = inviteToDom();
    let body: Record<string, unknown> = {};
    server.use(
      http.post("*/api/auth/sign-up/email", async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ user: TOMEK_ME, invitation: { listId: list.id } });
      }),
    );
    const { router } = renderApp(["/regulamin", PAGE]);

    await user.click(await screen.findByRole("button", { name: "Załóż konto i dołącz" }));
    expect(await screen.findByText("Po założeniu konta dołączysz do listy „Dom”.")).toBeVisible();
    await user.type(screen.getByRole("textbox", { name: "E-mail" }), TOMEK_ME.email);
    await fillSignUp(user);
    await user.click(screen.getByRole("button", { name: "Załóż konto" }));

    expect(await screen.findByText("Dołączyłeś(-aś) do listy „Dom”.")).toBeVisible();
    expect(body["invitationToken"]).toBe(TOKEN);
    expect(accepts.count).toBe(0);
    expect(router.state.location.pathname).toBe(`/listy/${list.id}`);
    await router.navigate(-1);
    expect(router.state.location.pathname).toBe("/regulamin");
  });

  // T-019: sesja może się przerysować przed przejściem routera (`startTransition`); tu tak jest
  // zawsze — Query powiadamia synchronicznie. Strażnik nie może wtedy wysłać drugiego `accept`.
  it("sign up: no second accept when the session renders before the navigation (T-019)", async () => {
    const user = userEvent.setup();
    anonymousUntilSignedIn();
    const { list, accepts } = inviteToDom();
    server.use(
      http.post("*/api/auth/sign-up/email", () =>
        HttpResponse.json({ user: TOMEK_ME, invitation: { listId: list.id } }),
      ),
    );
    const { router } = renderApp(PAGE);

    await user.click(await screen.findByRole("button", { name: "Załóż konto i dołącz" }));
    await user.type(await screen.findByRole("textbox", { name: "E-mail" }), TOMEK_ME.email);
    await fillSignUp(user);
    notifyManager.setScheduler((callback) => {
      callback();
    });
    try {
      await user.click(screen.getByRole("button", { name: "Załóż konto" }));
      expect(await screen.findByText("Dołączyłeś(-aś) do listy „Dom”.")).toBeVisible();
    } finally {
      notifyManager.setScheduler(defaultScheduler);
    }
    expect(accepts.count).toBe(0);
    expect(router.state.location.pathname).toBe(`/listy/${list.id}`);
  });

  it("sign up with a link that stopped working: the account exists, SC-08 says the link is dead", async () => {
    const user = userEvent.setup();
    const session = anonymousUntilSignedIn();
    inviteToDom();
    server.use(
      http.post("*/api/auth/sign-up/email", () => {
        server.use(
          http.get(`*/api/v1/invitations/${TOKEN}`, () =>
            apiError(410, { code: "invitation_invalid" }),
          ),
        );
        session.user = TOMEK_ME;
        return HttpResponse.json({
          user: TOMEK_ME,
          invitation: { error: { code: "invitation_invalid" } },
        });
      }),
    );
    renderApp(PAGE);

    await user.click(await screen.findByRole("button", { name: "Załóż konto i dołącz" }));
    await user.type(await screen.findByRole("textbox", { name: "E-mail" }), TOMEK_ME.email);
    await fillSignUp(user);
    await user.click(screen.getByRole("button", { name: "Załóż konto" }));

    const heading = await screen.findByRole("heading", { level: 1, name: "Ten link nie działa" });
    await waitFor(() => {
      expect(heading).toHaveFocus();
    });
  });
});
