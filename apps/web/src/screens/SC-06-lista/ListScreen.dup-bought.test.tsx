import type { Item } from "@lista/shared";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { aList, anItem, ANIA, detailsOf, TOMEK } from "../../../test/lists";
import { server } from "../../../test/msw-server";
import { renderApp, sessionIs } from "../../../test/render";

const DUP_BOUGHT =
  "„Chleb” jest już na liście jako kupione. Odznacz tę pozycję w sekcji „Kupione”, żeby kupić ponownie.";

async function showList(items: Item[]) {
  const user = userEvent.setup();
  const list = aList({ name: "Dom", members: [TOMEK] });
  const requests: unknown[] = [];
  server.use(
    http.get(`*/api/v1/lists/${list.id}`, () => HttpResponse.json(detailsOf(list, items))),
    http.post(`*/api/v1/lists/${list.id}/items`, async ({ request }) => {
      requests.push(await request.json());
      return HttpResponse.json({ error: { code: "duplicate_item" } }, { status: 409 });
    }),
  );
  renderApp(`/listy/${list.id}`);
  await screen.findByRole("heading", { level: 1, name: "Dom" });
  return { user, requests };
}

// AC5 (F-09): duplikat odhaczonej pozycji — jedyną drogą jest jej odznaczenie.
describe("SC-06 duplicate of a bought item", () => {
  beforeEach(() => {
    sessionIs(ANIA);
  });

  const bread = () =>
    anItem({
      name: "Chleb",
      checked: true,
      checkedBy: TOMEK,
      checkedAt: "2026-10-28T12:00:00.000Z",
    });

  it("warns with dup.bought and „Pokaż” without sending, keeping the typed text", async () => {
    const { user, requests } = await showList([anItem({ name: "Mleko" }), bread()]);
    const name = screen.getByRole("textbox", { name: "Co kupić?" });

    await user.type(name, "chleb{Enter}");

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(DUP_BOUGHT);
    expect(within(alert).getByRole("button", { name: "Pokaż" })).toBeVisible();
    expect(name).toHaveValue("chleb");
    expect(requests).toEqual([]);
  });

  it("„Pokaż” expands „Kupione” and moves focus to the bought item", async () => {
    const { user } = await showList([anItem({ name: "Mleko" }), bread()]);
    await user.type(screen.getByRole("textbox", { name: "Co kupić?" }), "chleb{Enter}");

    await user.click(screen.getByRole("button", { name: "Pokaż" }));

    expect(screen.getByRole("button", { name: "Kupione (1)" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    const bought = within(screen.getByRole("list", { name: "Kupione" }));
    expect(bought.getByRole("button", { name: "Odznacz Chleb" })).toHaveFocus();
  });

  it("drops the warning once the bought item is unchecked", async () => {
    const item = bread();
    const { user } = await showList([item]);
    server.use(
      http.patch("*/api/v1/lists/:listId/items/:itemId", () =>
        HttpResponse.json({ ...item, checked: false, checkedBy: null, checkedAt: null }),
      ),
    );
    await user.type(screen.getByRole("textbox", { name: "Co kupić?" }), "chleb{Enter}");
    await user.click(screen.getByRole("button", { name: "Pokaż" }));

    await user.click(screen.getByRole("button", { name: "Odznacz Chleb" }));

    expect(await screen.findByRole("button", { name: "Odhacz Chleb" })).toHaveFocus();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps dup.open without „Pokaż” for an unchecked duplicate", async () => {
    const { user } = await showList([anItem({ name: "Chleb" })]);

    await user.type(screen.getByRole("textbox", { name: "Co kupić?" }), "chleb{Enter}");

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("„Chleb” jest już na liście. Pozycja nie została dodana.");
    expect(within(alert).queryByRole("button", { name: "Pokaż" })).toBeNull();
  });
});
