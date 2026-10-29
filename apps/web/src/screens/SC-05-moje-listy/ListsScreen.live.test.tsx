import type { ListSummary } from "@lista/shared";
import { act, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { aList, ANIA, TOMEK } from "../../../test/lists";
import { liveServer } from "../../../test/live";
import { server } from "../../../test/msw-server";
import { renderApp, sessionIs } from "../../../test/render";

/** `GET /api/v1/lists` z listami, które test podmienia między odświeżeniami. */
function listsChangeable(initial: ListSummary[]) {
  let current = initial;
  server.use(http.get("*/api/v1/lists", () => HttpResponse.json(current)));
  return (next: ListSummary[]) => {
    current = next;
  };
}

const status = () => screen.getByRole("status", { name: "" });

// AC6 (F-14, SC-05: zmiany innych w ≤ 5 s, ogłoszenie nowej listy, „Info — usunięto dostęp”).
describe("SC-05 live changes", () => {
  beforeEach(() => {
    sessionIs(ANIA);
  });

  async function showLists(initial: ListSummary[]) {
    const live = liveServer();
    const setLists = listsChangeable(initial);
    renderApp("/listy");
    await screen.findByRole("heading", { level: 1, name: "Moje listy" });
    await waitFor(() => {
      expect(live.connections()).toBe(1);
    });
    return { live, setLists };
  }

  it("refreshes the cards on lists.changed: new name, count and a deleted list", async () => {
    const home = aList({ name: "Dom", toBuyCount: 2 });
    const plot = aList({ name: "Działka", role: "participant", owner: TOMEK });
    const { live, setLists } = await showLists([home, plot]);
    await screen.findByRole("link", { name: /Działka/ });

    setLists([{ ...home, name: "Dom i działka", toBuyCount: 1 }]);
    act(() => {
      live.send({ type: "lists.changed" });
    });

    expect(await screen.findByRole("link", { name: /Dom i działka/ })).toHaveTextContent(
      "1 do kupienia",
    );
    expect(screen.queryByRole("link", { name: /Działka$|^Działka/ })).toBeNull();
  });

  it("announces a list someone shared, without moving focus", async () => {
    const home = aList({ name: "Dom" });
    const { live, setLists } = await showLists([home]);
    const link = await screen.findByRole("link", { name: /Dom/ });
    link.focus();
    expect(status()).toHaveTextContent("");

    setLists([aList({ name: "Działka", role: "participant", owner: TOMEK }), home]);
    act(() => {
      live.send({ type: "lists.changed" });
    });

    await screen.findByRole("link", { name: /Działka/ });
    expect(status()).toHaveTextContent("Nowa lista: Działka");
    expect(link).toHaveFocus();
  });

  it("does not announce the lists of the first load", async () => {
    await showLists([aList({ name: "Działka", role: "participant", owner: TOMEK })]);

    await screen.findByRole("link", { name: /Działka/ });

    expect(status()).toHaveTextContent("");
  });

  it("shows the message about a list removed while it was open", async () => {
    listsChangeable([]);

    renderApp({ pathname: "/listy", state: { removedList: "Dom" } });

    expect(
      await screen.findByText("Lista „Dom” została usunięta albo nie masz już do niej dostępu."),
    ).toBeVisible();
  });
});
