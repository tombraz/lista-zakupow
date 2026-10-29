import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { aList, ANIA, apiError, detailsOf, TOMEK } from "../../../test/lists";
import { server } from "../../../test/msw-server";
import { renderApp, sessionIs } from "../../../test/render";

const TOKEN = "t".repeat(43);
const PAGE = `/zaproszenie/${TOKEN}`;
const TOMEK_ME = { ...TOMEK, email: "tomek@example.com" };

function previewIs(response: () => Response | Promise<Response>) {
  server.use(http.get(`*/api/v1/invitations/${TOKEN}`, response));
}

const validPreview = () => {
  previewIs(() => HttpResponse.json({ listName: "Dom", ownerName: "Ania" }));
};

function acceptIs(response: () => Response) {
  const calls = { count: 0 };
  server.use(
    http.post(`*/api/v1/invitations/${TOKEN}/accept`, () => {
      calls.count += 1;
      return response();
    }),
  );
  return calls;
}

async function expectFocusedHeading(name: string) {
  const heading = await screen.findByRole("heading", { level: 1, name });
  await waitFor(() => {
    expect(heading).toHaveFocus();
  });
}

// AC3–AC7 (F-11, F-12, MC-02): SC-08 w każdym stanie.
describe("SC-08 Zaproszenie", () => {
  it("says it is checking the link while the preview loads", async () => {
    sessionIs(null);
    previewIs(async () => {
      await delay(200);
      return HttpResponse.json({ listName: "Dom", ownerName: "Ania" });
    });

    renderApp(PAGE);

    expect(await screen.findByText("Sprawdzamy zaproszenie…")).toBeVisible();
    await expectFocusedHeading("Zaproszenie do listy");
  });

  it("anonymous: who invites to which list, focus on h1, sign-up and sign-in (AC3)", async () => {
    sessionIs(null);
    validPreview();

    renderApp(PAGE);

    await expectFocusedHeading("Zaproszenie do listy");
    expect(await screen.findByText("Ania zaprasza Cię do listy „Dom”.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Załóż konto i dołącz" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Mam konto — zaloguj się" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Dołącz do listy" })).not.toBeInTheDocument();
  });

  it("signed in: Dołącz do listy and Nie teraz to SC-05 (AC3)", async () => {
    sessionIs(TOMEK_ME);
    validPreview();

    renderApp(PAGE);

    expect(await screen.findByRole("button", { name: "Dołącz do listy" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Nie teraz" })).toHaveAttribute("href", "/listy");
    expect(screen.queryByRole("button", { name: "Załóż konto i dołącz" })).not.toBeInTheDocument();
  });

  it("joining opens SC-06 with „Dołączyłeś(-aś)…” and replaces SC-08 in history (AC4)", async () => {
    const user = userEvent.setup();
    sessionIs(TOMEK_ME);
    validPreview();
    const list = aList({ name: "Dom", role: "participant" });
    server.use(
      http.get(`*/api/v1/lists/${list.id}`, () => HttpResponse.json(detailsOf(list))),
      http.get("*/api/v1/lists", () => HttpResponse.json([list])),
    );
    acceptIs(() => HttpResponse.json({ listId: list.id }));
    const { router } = renderApp(["/listy", PAGE]);

    await user.click(await screen.findByRole("button", { name: "Dołącz do listy" }));

    expect(await screen.findByText("Dołączyłeś(-aś) do listy „Dom”.")).toBeVisible();
    expect(router.state.location.pathname).toBe(`/listy/${list.id}`);
    expect(router.state.historyAction).toBe("REPLACE");
    await router.navigate(-1);
    expect(router.state.location.pathname).toBe("/listy");
  });

  // T-020: blokada nie czeka na przerysowanie przycisku w stanie zapisu.
  it("joins once when „Dołącz do listy” is clicked twice before it re-renders (T-020)", async () => {
    sessionIs(TOMEK_ME);
    validPreview();
    const list = aList({ name: "Dom", role: "participant" });
    server.use(
      http.get(`*/api/v1/lists/${list.id}`, () => HttpResponse.json(detailsOf(list))),
      http.get("*/api/v1/lists", () => HttpResponse.json([list])),
    );
    const accepts = acceptIs(() => HttpResponse.json({ listId: list.id }));
    renderApp(["/listy", PAGE]);
    const join = await screen.findByRole("button", { name: "Dołącz do listy" });

    fireEvent.click(join);
    fireEvent.click(join);

    expect(await screen.findByText("Dołączyłeś(-aś) do listy „Dom”.")).toBeVisible();
    expect(accepts.count).toBe(1);
  });

  it("an invalid link: „Ten link nie działa” without list details (MC-02)", async () => {
    sessionIs(null);
    previewIs(() => apiError(410, { code: "invitation_invalid" }));

    renderApp(PAGE);

    await expectFocusedHeading("Ten link nie działa");
    expect(
      screen.getByText(
        "Zaproszenie wygasło, zostało już użyte albo unieważnione. Poproś właściciela listy o nowy link.",
      ),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Przejdź do aplikacji" })).toHaveAttribute(
      "href",
      "/listy",
    );
    expect(screen.queryByText(/zaprasza/)).not.toBeInTheDocument();
  });

  it("a link used in the meantime: joining shows „Ten link nie działa”", async () => {
    const user = userEvent.setup();
    sessionIs(TOMEK_ME);
    validPreview();
    acceptIs(() => apiError(410, { code: "invitation_invalid" }));
    renderApp(PAGE);

    await user.click(await screen.findByRole("button", { name: "Dołącz do listy" }));

    await expectFocusedHeading("Ten link nie działa");
    expect(screen.queryByText(/zaprasza/)).not.toBeInTheDocument();
  });

  it("the list is full: says so and does not offer joining again (AC6)", async () => {
    const user = userEvent.setup();
    sessionIs(TOMEK_ME);
    validPreview();
    acceptIs(() => apiError(409, { code: "limit_reached", limit: "participants" }));
    renderApp(PAGE);

    await user.click(await screen.findByRole("button", { name: "Dołącz do listy" }));

    expect(
      await screen.findByText(
        "Lista ma już 20 uczestników, więc nie możesz dołączyć. Daj znać właścicielowi listy.",
      ),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Dołącz do listy" })).not.toBeInTheDocument();
  });

  it.each([
    ["already_member", "Już jesteś na tej liście."],
    ["own_list", "To Twoja lista — nie musisz dołączać."],
  ])("%s: „%s” and Otwórz listę (AC7)", async (code, text) => {
    const user = userEvent.setup();
    sessionIs(code === "own_list" ? ANIA : TOMEK_ME);
    validPreview();
    const listId = "00000000-0000-7000-8000-00000000abcd";
    acceptIs(() => apiError(409, { code, listId }));
    renderApp(PAGE);

    await user.click(await screen.findByRole("button", { name: "Dołącz do listy" }));

    expect(await screen.findByText(text)).toBeVisible();
    expect(screen.getByRole("link", { name: "Otwórz listę" })).toHaveAttribute(
      "href",
      `/listy/${listId}`,
    );
    expect(screen.queryByRole("button", { name: "Dołącz do listy" })).not.toBeInTheDocument();
  });

  it("no network while checking: says so", async () => {
    sessionIs(null);
    previewIs(() => HttpResponse.error());

    renderApp(PAGE);

    expect(
      await screen.findByText("Brak połączenia. Sprawdź internet i spróbuj ponownie."),
    ).toBeVisible();
  });

  it("no network while joining: says so and lets you try again", async () => {
    const user = userEvent.setup();
    sessionIs(TOMEK_ME);
    validPreview();
    acceptIs(() => HttpResponse.error());
    renderApp(PAGE);

    await user.click(await screen.findByRole("button", { name: "Dołącz do listy" }));

    expect(
      await screen.findByText("Brak połączenia. Sprawdź internet i spróbuj ponownie."),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Dołącz do listy" })).toBeEnabled();
  });
});
