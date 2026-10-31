import type { Item, ListSummary } from "@lista/shared";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { RouteObject } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";
import { aList, anItem, ANIA, detailsOf, listsAre } from "../test/lists";
import { server } from "../test/msw-server";
import { heldResponse } from "../test/held";
import { renderApp, sessionIs } from "../test/render";
import { routes } from "./routes";

/** Lista „Dom” Ani na SC-05, jej SC-06 i SC-07. */
function homeListIs(items: Item[] = [anItem({ name: "Chleb" })]): ListSummary {
  const list = aList({ name: "Dom", toBuyCount: items.length });
  listsAre([list]);
  server.use(
    http.get(`*/api/v1/lists/${list.id}`, () => HttpResponse.json(detailsOf(list, items))),
    http.get(`*/api/v1/lists/${list.id}/invitations`, () => HttpResponse.json([])),
  );
  return list;
}

const heading = (name: string) => screen.findByRole("heading", { level: 1, name });

/** Wejście na SC-05 i przejście klawiaturą do karty listy „Dom”. */
async function openHomeListFromLists() {
  const user = userEvent.setup();
  const app = renderApp("/listy");
  const card = await screen.findByRole("link", { name: /^Dom/ });
  card.focus();
  await user.keyboard("{Enter}");
  return { user, ...app };
}

// WCAG 2.4.3 (N-04, accessibility.md „Focus is managed on route changes”), przegląd E-01 S2.
describe("focus after a route change (T-014)", () => {
  beforeEach(() => {
    sessionIs(ANIA);
  });

  it("focuses the list name heading when SC-05 opens a list with items (AC1)", async () => {
    homeListIs();

    await openHomeListFromLists();

    const title = await heading("Dom");
    await waitFor(() => {
      expect(title).toHaveFocus();
    });
  });

  it("waits for the list name before focusing the SC-06 heading", async () => {
    const list = homeListIs();
    const response = heldResponse();
    server.use(
      http.get(`*/api/v1/lists/${list.id}`, async () => {
        await response.released;
        return HttpResponse.json(detailsOf(list, [anItem({ name: "Chleb" })]));
      }),
    );

    await openHomeListFromLists();

    const pending = await screen.findByRole("heading", { level: 1 });
    expect(pending).toHaveTextContent("");
    expect(pending).not.toHaveFocus();
    response.release();
    const title = await heading("Dom");
    await waitFor(() => {
      expect(title).toHaveFocus();
    });
  });

  it("focuses the add field, not the heading, when SC-05 opens an empty list (AC2, T-011)", async () => {
    homeListIs([]);

    await openHomeListFromLists();

    await heading("Dom");
    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "Co kupić?" })).toHaveFocus();
    });
  });

  it("focuses the heading of SC-07 and of SC-06 again after going there and back (AC2)", async () => {
    homeListIs();
    const { user } = await openHomeListFromLists();
    await heading("Dom");

    await user.click(screen.getByRole("link", { name: "Uczestnicy" }));
    const participants = await heading("Uczestnicy");
    await waitFor(() => {
      expect(participants).toHaveFocus();
    });

    await user.click(screen.getByRole("link", { name: "Wstecz" }));
    const list = await heading("Dom");
    await waitFor(() => {
      expect(list).toHaveFocus();
    });
  });

  it("focuses the heading of SC-09 opened from SC-05 (AC2)", async () => {
    homeListIs();
    const user = userEvent.setup();
    renderApp("/listy");
    await heading("Moje listy");

    await user.click(screen.getByRole("link", { name: "Konto" }));

    const account = await heading("Konto");
    await waitFor(() => {
      expect(account).toHaveFocus();
    });
  });

  it("focuses the heading of SC-05 after the browser back button (AC3)", async () => {
    homeListIs();
    const { router } = await openHomeListFromLists();
    await heading("Dom");

    await act(() => router.navigate(-1));

    const lists = await heading("Moje listy");
    await waitFor(() => {
      expect(lists).toHaveFocus();
    });
  });
});

// SC-04 nie ma AppBar, więc ustawia fokus sam (web.md „Pułapki”, T-014 „Prevention” #3).
describe("focus on SC-04 after a route change (T-022)", () => {
  const terms = () => heading("Regulamin i polityka prywatności");

  it("focuses the SC-04 heading opened by keyboard from SC-09 (AC1)", async () => {
    sessionIs(ANIA);
    homeListIs();
    const user = userEvent.setup();
    renderApp("/konto");
    await heading("Konto");

    screen.getByRole("link", { name: "Regulamin i polityka prywatności" }).focus();
    await user.keyboard("{Enter}");

    const title = await terms();
    await waitFor(() => {
      expect(title).toHaveFocus();
    });
  });

  it("focuses the SC-04 heading opened from SC-01, and „Wróć” gives SC-01 its own focus (AC2)", async () => {
    sessionIs(null);
    const user = userEvent.setup();
    renderApp("/logowanie");
    await heading("Zaloguj się");

    await user.click(screen.getByRole("link", { name: "Regulamin i polityka prywatności" }));
    const title = await terms();
    await waitFor(() => {
      expect(title).toHaveFocus();
    });

    await user.click(screen.getByRole("link", { name: "Wróć" }));
    await heading("Zaloguj się");
    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "E-mail" })).toHaveFocus();
    });
  });

  it("focuses the section named in the address, not the heading (SC-02 → #polityka-prywatnosci)", async () => {
    sessionIs(null);
    renderApp("/regulamin#polityka-prywatnosci");

    await terms();
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 2, name: "Polityka prywatności" })).toHaveFocus();
    });
  });

  it("keeps focus on the section chosen in the table of contents (AC3)", async () => {
    sessionIs(null);
    const user = userEvent.setup();
    renderApp("/regulamin");
    await waitFor(async () => {
      expect(await terms()).toHaveFocus();
    });

    await user.click(screen.getByRole("link", { name: "Polityka prywatności" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 2, name: "Polityka prywatności" })).toHaveFocus();
    });
  });
});

const TOKEN = "t".repeat(43);

/** Ścieżki z `routes.tsx` (także zagnieżdżone pod strażnikami). */
function pathsOf(tree: RouteObject[]): string[] {
  return tree.flatMap((route) => [
    ...(route.path ? [route.path] : []),
    ...pathsOf(route.children ?? []),
  ]);
}

interface RouteCase {
  signedIn: boolean;
  from: (list: ListSummary) => string;
  to: (list: ListSummary) => string;
  heading: string;
}

/** Każda trasa ekranu: skąd do niej przechodzimy i jaki `h1` ma nowy ekran. */
const ROUTES: Record<string, RouteCase> = {
  "/logowanie": {
    signedIn: false,
    from: () => "/regulamin",
    to: () => "/logowanie",
    heading: "Zaloguj się",
  },
  "/rejestracja": {
    signedIn: false,
    from: () => "/logowanie",
    to: () => "/rejestracja",
    heading: "Załóż konto",
  },
  "/regulamin": {
    signedIn: false,
    from: () => "/logowanie",
    to: () => "/regulamin",
    heading: "Regulamin i polityka prywatności",
  },
  "/zaproszenie/:token": {
    signedIn: false,
    from: () => "/regulamin",
    to: () => `/zaproszenie/${TOKEN}`,
    heading: "Zaproszenie do listy",
  },
  "/listy": { signedIn: true, from: () => "/konto", to: () => "/listy", heading: "Moje listy" },
  "/listy/:listId": {
    signedIn: true,
    from: () => "/listy",
    to: (l) => `/listy/${l.id}`,
    heading: "Dom",
  },
  "/listy/:listId/uczestnicy": {
    signedIn: true,
    from: (l) => `/listy/${l.id}`,
    to: (l) => `/listy/${l.id}/uczestnicy`,
    heading: "Uczestnicy",
  },
  "/konto": { signedIn: true, from: () => "/listy", to: () => "/konto", heading: "Konto" },
};
/** Trasy bez własnego ekranu (przekierowanie). */
const NO_SCREEN = ["*"];

// Kontrola z T-022: nowy ekran bez obsługi fokusu (jak SC-04 bez AppBar) albo nowa trasa bez wpisu
// w ROUTES — test pada (web.md „Pułapki”).
describe("focus after a route change, every route (T-022 prevention)", () => {
  it("lists every route of routes.tsx", () => {
    expect([...Object.keys(ROUTES), ...NO_SCREEN].sort()).toEqual(pathsOf(routes).sort());
  });

  it.each(Object.entries(ROUTES))("%s leaves focus off body", async (_, route) => {
    sessionIs(route.signedIn ? ANIA : null);
    const list = homeListIs();
    server.use(
      http.get(`*/api/v1/invitations/${TOKEN}`, () =>
        HttpResponse.json({ listName: "Dom", ownerName: "Ania" }),
      ),
    );
    const { router } = renderApp(route.from(list));
    await screen.findByRole("heading", { level: 1 });

    await act(() => router.navigate(route.to(list)));

    await heading(route.heading);
    await waitFor(() => {
      const focused = document.activeElement;
      expect(focused).not.toBe(document.body);
      expect(document.body).toContainElement(focused as HTMLElement);
    });
  });
});
