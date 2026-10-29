import type { Invitation, ListSummary } from "@lista/shared";
import { act, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { aList, ANIA, detailsOf, listsAre, TOMEK } from "../../../test/lists";
import { liveServer } from "../../../test/live";
import { server } from "../../../test/msw-server";
import { renderApp, sessionIs } from "../../../test/render";

const LINK: Invitation = {
  id: "inv-1",
  url: `http://localhost/zaproszenie/${"a".repeat(43)}`,
  expiresAt: "2026-11-09T10:00:00.000Z",
};

async function showParticipants(list: ListSummary, links: Invitation[] = []) {
  const live = liveServer();
  const state = { list, links };
  server.use(
    http.get(`*/api/v1/lists/${list.id}`, () => HttpResponse.json(detailsOf(state.list))),
    http.get(`*/api/v1/lists/${list.id}/invitations`, () => HttpResponse.json(state.links)),
  );
  listsAre([]);
  renderApp(`/listy/${list.id}/uczestnicy`);
  await screen.findByRole("heading", { level: 1, name: "Uczestnicy" });
  await waitFor(() => {
    expect(live.received()).toContainEqual({ type: "subscribe", listId: list.id });
  });
  return { live, state };
}

const invitations = () => within(screen.getByRole("region", { name: "Zaproszenia" }));

// AC7, AC5 (F-11, F-12, SC-07: wykorzystany link znika w ≤ 5 s; „No permission” w trakcie).
describe("SC-07 live changes", () => {
  beforeEach(() => {
    sessionIs(ANIA);
  });

  it("removes a link someone accepted and shows the new participant", async () => {
    const list = aList({ name: "Dom" });
    const { live, state } = await showParticipants(list, [LINK]);
    await screen.findByRole("region", { name: "Zaproszenia" });
    expect(invitations().getAllByRole("group")).toHaveLength(1);

    state.links = [];
    state.list = { ...list, members: [TOMEK] };
    act(() => {
      live.send({ type: "invitations.changed", listId: list.id });
      live.send({ type: "members.changed", listId: list.id });
    });

    await waitFor(() => {
      expect(invitations().queryAllByRole("group")).toHaveLength(0);
    });
    expect(await screen.findByRole("region", { name: "Na liście (1 z 20)" })).toBeVisible();
  });

  it("ignores invitations.changed of another list", async () => {
    const list = aList({ name: "Dom" });
    const { live, state } = await showParticipants(list, [LINK]);
    await screen.findByRole("region", { name: "Zaproszenia" });

    state.links = [];
    act(() => {
      live.send({ type: "invitations.changed", listId: "another-list" });
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(invitations().getAllByRole("group")).toHaveLength(1);
  });

  it("returns a participant to „Moje listy” when the owner deletes the list", async () => {
    const list = aList({ name: "Dom", role: "participant", owner: TOMEK });
    const { live } = await showParticipants(list);

    act(() => {
      live.send({ type: "list.deleted", listId: list.id });
    });

    expect(
      await screen.findByText("Lista „Dom” została usunięta albo nie masz już do niej dostępu."),
    ).toBeVisible();
  });
});
