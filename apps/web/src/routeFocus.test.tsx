import type { Item, ListSummary } from "@lista/shared";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { aList, anItem, ANIA, detailsOf, listsAre } from "../test/lists";
import { server } from "../test/msw-server";
import { renderApp, sessionIs } from "../test/render";

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
