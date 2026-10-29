import type { Item, ListRole } from "@lista/shared";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aList, anItem, ANIA, detailsOf, listsAre, TOMEK } from "../../../test/lists";
import { liveServer } from "../../../test/live";
import { server } from "../../../test/msw-server";
import { renderApp, sessionIs } from "../../../test/render";

const MILK = anItem({ name: "Mleko", updatedAt: "2026-10-29T10:00:00.000Z" });
const BREAD = anItem({ name: "Chleb", updatedAt: "2026-10-29T10:00:00.000Z" });

async function openList({
  role = "owner",
  items = [MILK, BREAD],
}: { role?: ListRole; items?: Item[] } = {}) {
  const user = userEvent.setup();
  const live = liveServer();
  const list = aList({ name: "Dom", role, members: [TOMEK] });
  server.use(
    http.get(`*/api/v1/lists/${list.id}`, () => HttpResponse.json(detailsOf(list, items))),
  );
  listsAre([]);
  const view = renderApp(`/listy/${list.id}`);
  await screen.findByRole("heading", { level: 1, name: "Dom" });
  await waitFor(() => {
    expect(live.received()).toContainEqual({ type: "subscribe", listId: list.id });
  });
  return { user, live, list, view };
}

const toBuy = () => within(screen.getByRole("list", { name: "Do kupienia" }));
const rowOf = (name: string) =>
  screen.getByRole("button", { name: `Edytuj ${name}` }).closest("li");

function reducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query === "(prefers-reduced-motion: reduce)",
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

// AC4, AC5 (F-14, SC-06 „Live update”, „Dostęp odebrany / lista usunięta”).
describe("SC-06 live changes of other people", () => {
  beforeEach(() => {
    sessionIs(ANIA);
    reducedMotion(false);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows Tomek's check without moving focus, highlights the row and updates the count", async () => {
    const { user, live, list } = await openList();
    const focused = screen.getByRole("button", { name: "Odhacz Chleb" });
    focused.focus();
    expect(screen.getByText("2 do kupienia")).toBeInTheDocument();

    act(() => {
      live.send({
        type: "item.upserted",
        listId: list.id,
        item: {
          ...MILK,
          checked: true,
          checkedBy: TOMEK,
          checkedAt: "2026-10-29T10:05:00.000Z",
          updatedAt: "2026-10-29T10:05:00.000Z",
        },
      });
    });

    await waitFor(() => {
      expect(toBuy().queryByRole("button", { name: "Edytuj Mleko" })).toBeNull();
    });
    expect(screen.getByText("1 do kupienia")).toBeInTheDocument();
    expect(document.activeElement).toBe(focused);
    await user.click(screen.getByRole("button", { name: "Kupione (1)" }));
    expect(screen.getByText(/kupił\(a\) Tomek/)).toBeInTheDocument();
    expect(rowOf("Mleko")).toHaveAttribute("data-highlighted", "true");
  });

  it("updates only the „N do kupienia” status when someone adds an item", async () => {
    const { live, list } = await openList();
    expect(screen.getByText("2 do kupienia")).toBeInTheDocument();

    act(() => {
      live.send({
        type: "item.upserted",
        listId: list.id,
        item: anItem({ name: "Masło", addedBy: TOMEK, createdAt: "2026-10-29T10:06:00.000Z" }),
      });
    });

    expect(await screen.findByText("3 do kupienia")).toBeInTheDocument();
    expect(toBuy().getAllByRole("listitem")[0]).toHaveTextContent("Masło");
    expect(screen.queryByText(/Dodano Masło/)).toBeNull();
  });

  it("does not highlight with reduced motion", async () => {
    reducedMotion(true);
    const { live, list } = await openList();

    act(() => {
      live.send({
        type: "item.upserted",
        listId: list.id,
        item: { ...MILK, note: "2 l", updatedAt: "2026-10-29T10:05:00.000Z" },
      });
    });

    await screen.findByText(/2 l/);
    expect(rowOf("Mleko")).not.toHaveAttribute("data-highlighted");
  });

  it("shows the new list name in the app bar heading", async () => {
    const { live, list } = await openList({ role: "participant" });

    act(() => {
      live.send({ type: "list.updated", listId: list.id, name: "Dom i działka" });
    });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Dom i działka" }),
    ).toBeInTheDocument();
  });

  it("returns a participant to „Moje listy” with a message when the owner deletes the list", async () => {
    const { live, list, view } = await openList({ role: "participant" });

    act(() => {
      live.send({ type: "list.deleted", listId: list.id });
      live.send({ type: "access.revoked", listId: list.id });
    });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Moje listy" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Lista „Dom” została usunięta albo nie masz już do niej dostępu."),
    ).toBeInTheDocument();
    expect(view.router.state.location.pathname).toBe("/listy");
  });

  it("returns to „Moje listy” on access.revoked alone", async () => {
    const { live, list } = await openList({ role: "participant" });

    act(() => {
      live.send({ type: "access.revoked", listId: list.id });
    });

    expect(
      await screen.findByText("Lista „Dom” została usunięta albo nie masz już do niej dostępu."),
    ).toBeInTheDocument();
  });

  it("shows no such message to the owner who deleted the list", async () => {
    const { user, live, list } = await openList();
    server.use(
      // Serwer rozsyła zdarzenia po zatwierdzeniu, zanim wyśle odpowiedź.
      http.delete(`*/api/v1/lists/${list.id}`, async () => {
        live.send({ type: "list.deleted", listId: list.id });
        live.send({ type: "access.revoked", listId: list.id });
        // eslint-disable-next-line no-restricted-syntax -- porządek: zdarzenie WS przed odpowiedzią HTTP, nie okno na kroki testu (T-021)
        await delay(100);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await user.click(screen.getByRole("button", { name: "Więcej opcji" }));
    await user.click(screen.getByRole("button", { name: "Usuń listę" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Usuń listę" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Moje listy" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/została usunięta albo nie masz/)).toBeNull();
  });

  it("tells the person editing an item that someone else deleted it", async () => {
    const { user, live, list } = await openList();
    await user.click(screen.getByRole("button", { name: "Edytuj Mleko" }));
    await screen.findByRole("dialog", { name: "Edytuj pozycję" });

    act(() => {
      live.send({ type: "item.deleted", listId: list.id, itemId: MILK.id });
    });

    expect(
      await screen.findByText("Ta pozycja została usunięta przez inną osobę."),
    ).toBeInTheDocument();
  });

  // QA E2E J-03 (T-009): zdarzenie własnego odhaczenia przychodzi przed odpowiedzią API.
  it("keeps focus on the next item when the own check event comes before the response", async () => {
    const eggs = anItem({ name: "Jajka", updatedAt: "2026-10-29T10:00:00.000Z" });
    const { user, live, list } = await openList({ items: [eggs, BREAD, MILK] });
    const checkedBread = {
      ...BREAD,
      checked: true,
      checkedBy: { id: ANIA.id, name: ANIA.name },
      checkedAt: "2026-10-29T10:05:00.000Z",
      updatedAt: "2026-10-29T10:05:00.000Z",
    };
    server.use(
      http.patch(`*/api/v1/lists/${list.id}/items/:id`, async () => {
        live.send({ type: "item.upserted", listId: list.id, item: checkedBread });
        // eslint-disable-next-line no-restricted-syntax -- porządek: zdarzenie WS przed odpowiedzią HTTP, nie okno na kroki testu (T-021)
        await delay(100);
        return HttpResponse.json(checkedBread);
      }),
    );

    await user.click(screen.getByRole("button", { name: "Odhacz Chleb" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Odhacz Mleko" })).toHaveFocus();
    });
    expect(screen.getByText("2 do kupienia")).toBeInTheDocument();
    // Własna zmiana nie jest „zmianą innej osoby”: bez podświetlenia.
    await user.click(screen.getByRole("button", { name: "Kupione (1)" }));
    expect(rowOf("Chleb")).not.toHaveAttribute("data-highlighted");
  });
});
