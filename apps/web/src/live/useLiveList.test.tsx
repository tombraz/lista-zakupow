import type { ListDetails } from "@lista/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { aList, anItem, detailsOf, TOMEK } from "../../test/lists";
import { liveServer } from "../../test/live";
import { server } from "../../test/msw-server";
import { listKey, useList } from "../lists/useList";
import { LiveProvider } from "./LiveProvider";
import { useLiveList } from "./useLiveList";

const MILK = anItem({ name: "Mleko", updatedAt: "2026-10-29T10:00:00.000Z" });
const LIST = detailsOf(aList({ name: "Dom" }), [MILK]);

function setup(details: ListDetails = LIST) {
  const live = liveServer();
  let fetches = 0;
  server.use(
    http.get(`*/api/v1/lists/${details.id}`, () => {
      fetches += 1;
      return HttpResponse.json(details);
    }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <LiveProvider>{children}</LiveProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
  const hook = renderHook(
    ({ listId }: { listId: string }) => {
      const list = useList(listId);
      return { list, live: useLiveList(listId) };
    },
    { wrapper, initialProps: { listId: details.id } },
  );
  const items = () => client.getQueryData<ListDetails>(listKey(details.id))?.items ?? [];
  return { live, hook, items, fetches: () => fetches };
}

const subscribe = { type: "subscribe", listId: LIST.id };

async function subscribed(live: ReturnType<typeof liveServer>, count = 1) {
  await waitFor(() => {
    expect(
      live.received().filter((m) => JSON.stringify(m) === JSON.stringify(subscribe)),
    ).toHaveLength(count);
  });
}

describe("useLiveList (AC4, AC8)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("subscribes to the list and unsubscribes when the screen closes", async () => {
    const { live, hook } = setup();

    await subscribed(live);
    hook.rerender({ listId: "another-list" });

    await waitFor(() => {
      expect(live.received()).toContainEqual({ type: "unsubscribe", listId: LIST.id });
    });
  });

  it("applies a newer item and a new item, and ignores one not newer than the cache", async () => {
    const { live, hook, items } = setup();
    await waitFor(() => {
      expect(hook.result.current.list.data).toBeDefined();
    });
    await subscribed(live);

    const checked = {
      ...MILK,
      checked: true,
      checkedBy: TOMEK,
      checkedAt: "2026-10-29T10:01:00.000Z",
      updatedAt: "2026-10-29T10:01:00.000Z",
    };
    act(() => {
      live.send({ type: "item.upserted", listId: LIST.id, item: checked });
    });
    await waitFor(() => {
      expect(items()).toEqual([checked]);
    });
    expect(hook.result.current.live.highlighted).toEqual(new Set([MILK.id]));

    act(() => {
      live.send({ type: "item.upserted", listId: LIST.id, item: { ...MILK, name: "Stare" } });
      live.send({ type: "item.upserted", listId: LIST.id, item: { ...checked, note: "x" } });
    });
    const bread = anItem({ name: "Chleb", createdAt: "2026-10-29T10:02:00.000Z" });
    act(() => {
      live.send({ type: "item.upserted", listId: LIST.id, item: bread });
    });
    await waitFor(() => {
      expect(items()).toEqual([bread, checked]);
    });
  });

  it("ignores events of other lists", async () => {
    const { live, hook, items } = setup();
    await waitFor(() => {
      expect(hook.result.current.list.data).toBeDefined();
    });
    await subscribed(live);

    act(() => {
      live.send({ type: "item.deleted", listId: "another-list", itemId: MILK.id });
      live.send({ type: "item.upserted", listId: "another-list", item: anItem() });
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(items()).toEqual([MILK]);
  });

  it("removes deleted and cleared items", async () => {
    const bread = anItem({ name: "Chleb", checked: true });
    const eggs = anItem({ name: "Jajka", checked: true });
    const { live, hook, items } = setup(detailsOf(aList(), [MILK, bread, eggs]));
    await waitFor(() => {
      expect(hook.result.current.list.data).toBeDefined();
    });
    const listId = hook.result.current.list.data?.id ?? "";

    act(() => {
      live.send({ type: "item.deleted", listId, itemId: MILK.id });
    });
    await waitFor(() => {
      expect(items()).toEqual([bread, eggs]);
    });
    act(() => {
      live.send({ type: "items.cleared", listId, itemIds: [bread.id, eggs.id] });
    });
    await waitFor(() => {
      expect(items()).toEqual([]);
    });
  });

  it("after the server drops the connection: reconnects, subscribes again and fetches the list", async () => {
    const { live, fetches, hook } = setup();
    await waitFor(() => {
      expect(hook.result.current.list.data).toBeDefined();
    });
    await subscribed(live);
    expect(fetches()).toBe(1);

    live.dropAll();

    await waitFor(
      () => {
        expect(live.connections()).toBe(2);
      },
      { timeout: 3000 },
    );
    await subscribed(live, 2);
    await waitFor(() => {
      expect(fetches()).toBe(2);
    });
  });

  it("answers ping with pong, and reconnects when no ping comes for 35 s", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["setTimeout", "clearTimeout"] });
    const { live, hook } = setup();
    await waitFor(() => {
      expect(hook.result.current.list.data).toBeDefined();
    });
    await subscribed(live);

    act(() => {
      live.send({ type: "ping" });
    });
    await waitFor(() => {
      expect(live.receivedAll()).toContainEqual({ type: "pong" });
    });
    await act(() => vi.advanceTimersByTimeAsync(34_000));
    expect(live.connections()).toBe(1);
    await act(() => vi.advanceTimersByTimeAsync(2_000));

    await waitFor(() => {
      expect(live.connections()).toBe(2);
    });
    await subscribed(live, 2);
  });
});
