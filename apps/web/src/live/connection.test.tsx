import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aList, anItem, ANIA, detailsOf, listHandlers, listsAre, TOMEK } from "../../test/lists";
import { browserGoes, liveServer } from "../../test/live";
import { server } from "../../test/msw-server";
import { renderApp, sessionIs } from "../../test/render";

const OFFLINE = "Brak połączenia. Zmiany nie są zapisywane.";
const RESTORED = "Połączenie przywrócone.";

const LIST = aList({ name: "Dom" });

async function openList() {
  const live = liveServer();
  server.use(
    http.get(`*/api/v1/lists/${LIST.id}`, () =>
      HttpResponse.json(detailsOf(LIST, [anItem({ name: "Chleb" })])),
    ),
  );
  renderApp(`/listy/${LIST.id}`);
  await screen.findByRole("heading", { level: 1, name: "Dom" });
  await subscribed(live, 1);
  return live;
}

async function subscribed(live: ReturnType<typeof liveServer>, count: number) {
  await waitFor(() => {
    expect(
      live.received().filter((m) => JSON.stringify(m) === JSON.stringify(subscribe)),
    ).toHaveLength(count);
  });
}

const subscribe = { type: "subscribe", listId: LIST.id };

// AC1 (F-15, design-system.md OfflineBanner).
describe("OfflineBanner", () => {
  beforeEach(() => {
    sessionIs(ANIA);
    listsAre([LIST]);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("appears when the browser goes offline and disappears once the socket is open and subscribed", async () => {
    const live = await openList();
    expect(screen.queryByText(OFFLINE)).not.toBeInTheDocument();

    browserGoes("offline");

    const region = await screen.findByText(OFFLINE);
    expect(region.closest('[role="status"]')).toBeInTheDocument();

    browserGoes("online");
    await waitFor(() => {
      expect(live.connections()).toBe(2);
    });
    await subscribed(live, 2);
    // Gniazdo otwarte, ale serwer jeszcze nie potwierdził subskrypcji: zmiany nadal nie dochodzą.
    expect(screen.getByText(OFFLINE)).toBeInTheDocument();

    act(() => {
      live.send({ type: "subscribed", listId: LIST.id });
    });

    await waitFor(() => {
      expect(screen.queryByText(OFFLINE)).not.toBeInTheDocument();
    });
    // Zniknięcie ogłoszone w tym samym regionie.
    expect(screen.getByText(RESTORED).closest('[role="status"]')).toBeInTheDocument();
  });

  it("appears when no ping comes 10 s after the expected one (25 s), on SC-05 too", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["setTimeout", "clearTimeout"] });
    const live = liveServer();
    renderApp("/listy");
    await screen.findByRole("heading", { level: 1, name: "Moje listy" });
    await waitFor(() => {
      expect(live.connections()).toBe(1);
    });
    act(() => {
      live.send({ type: "ping" });
    });
    await waitFor(() => {
      expect(live.receivedAll()).toContainEqual({ type: "pong" });
    });

    await act(() => vi.advanceTimersByTimeAsync(34_000));
    expect(screen.queryByText(OFFLINE)).not.toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(1_500));

    expect(screen.getByText(OFFLINE)).toBeInTheDocument();
  });
});

// AC4 (F-15: po powrocie połączenia aktualny stan, także zmiany innych z czasu przerwy).
describe("back online", () => {
  beforeEach(() => {
    sessionIs(ANIA);
    listsAre([LIST]);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("SC-06: subscribes again and shows what others changed during the break, focus stays", async () => {
    const user = userEvent.setup();
    const live = liveServer();
    const bread = anItem({ name: "Chleb" });
    let items = [bread];
    let fetches = 0;
    server.use(
      http.get(`*/api/v1/lists/${LIST.id}`, () => {
        fetches += 1;
        return HttpResponse.json(detailsOf(LIST, items));
      }),
    );
    renderApp(`/listy/${LIST.id}`);
    await screen.findByText("1 do kupienia");
    await subscribed(live, 1);
    const field = screen.getByRole("textbox", { name: "Co kupić?" });
    await user.click(field);

    browserGoes("offline");
    await screen.findByText(OFFLINE);
    // Ania w tym czasie: dodaje „Masło”, odhacza „Chleb” (zdarzenia do Tomka nie dochodzą).
    items = [
      anItem({ name: "Masło" }),
      { ...bread, checked: true, checkedBy: ANIA, checkedAt: "2026-11-01T10:00:00.000Z" },
    ];
    const fetchesBefore = fetches;

    browserGoes("online");
    await subscribed(live, 2);
    act(() => {
      live.send({ type: "subscribed", listId: LIST.id });
    });

    expect(await screen.findByRole("button", { name: "Edytuj Masło" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Kupione \(1\)/ })).toBeInTheDocument();
    expect(fetches).toBeGreaterThan(fetchesBefore);
    await waitFor(() => {
      expect(screen.queryByText(OFFLINE)).not.toBeInTheDocument();
    });
    expect(field).toHaveFocus();
  });

  it("SC-07: after a silent drop (no browser event) fetches the participants again", async () => {
    // Bez zdarzenia przeglądarki pierwsza próba połączenia idzie po 1000 ms (`liveSocket.ts`,
    // backoff), czyli na granicy domyślnego limitu `waitFor`. Sztuczny zegar przesuwamy jawnie,
    // by test nie zależał od rzeczywistego czasu ponownego połączenia (T-083).
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["setTimeout", "clearTimeout"] });
    const live = liveServer();
    let list = aList({ ...LIST, members: [] });
    server.use(...listHandlers(() => list));
    server.use(http.get(`*/api/v1/lists/${LIST.id}/invitations`, () => HttpResponse.json([])));
    renderApp(`/listy/${LIST.id}/uczestnicy`);
    await screen.findByRole("heading", { level: 1, name: "Uczestnicy" });
    await subscribed(live, 1);
    expect(screen.queryByText("Tomek")).not.toBeInTheDocument();

    list = aList({ ...LIST, members: [TOMEK] });
    live.dropAll();
    await screen.findByText(OFFLINE);

    await act(() => vi.advanceTimersByTimeAsync(1_000));
    await subscribed(live, 2);
    act(() => {
      live.send({ type: "subscribed", listId: LIST.id });
    });
    expect(await screen.findByText("Tomek")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText(OFFLINE)).not.toBeInTheDocument();
    });
  });
});
