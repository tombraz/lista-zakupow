import type { Item } from "@lista/shared";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { aList, anItem, ANIA, apiError, detailsOf, TOMEK } from "../../../test/lists";
import { server } from "../../../test/msw-server";
import { heldResponse, type HeldResponse } from "../../../test/held";
import { renderApp, sessionIs } from "../../../test/render";

const bought = (name: string) =>
  anItem({ name, checked: true, checkedBy: TOMEK, checkedAt: "2026-10-28T12:00:00.000Z" });

async function showList(items: Item[]) {
  const user = userEvent.setup();
  const list = aList({ name: "Dom", members: [TOMEK] });
  server.use(
    http.get(`*/api/v1/lists/${list.id}`, () => HttpResponse.json(detailsOf(list, items))),
  );
  renderApp(`/listy/${list.id}`);
  await screen.findByRole("heading", { level: 1, name: "Dom" });
  return { user, list };
}

/** `POST …/clear-checked` usuwa podane pozycje; zwraca liczbę żądań. */
function clearingSucceeds(listId: string, deleted: Item[], response?: HeldResponse) {
  const requests: string[] = [];
  server.use(
    http.post(`*/api/v1/lists/${listId}/items/clear-checked`, async ({ request }) => {
      requests.push(request.method);
      await response?.released;
      return HttpResponse.json({ deletedIds: deleted.map(({ id }) => id) });
    }),
  );
  return requests;
}

async function openClearDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /^Kupione \(\d+\)$/ }));
  const open = screen.getByRole("button", { name: "Usuń wszystkie kupione" });
  await user.click(open);
  return { open, dialog: screen.getByRole("alertdialog", { name: "Usunąć 2 kupionych pozycji?" }) };
}

// AC4 (F-08): „Usuń wszystkie kupione” po potwierdzeniu; stan „Wszystko kupione.”
describe("SC-06 „Usuń wszystkie kupione”", () => {
  beforeEach(() => {
    sessionIs(ANIA);
  });

  it("shows „Wszystko kupione.” when nothing is left to buy", async () => {
    await showList([bought("Chleb"), bought("Jajka")]);

    expect(screen.getByText("Wszystko kupione.")).toBeVisible();
    expect(screen.queryByRole("list", { name: "Do kupienia" })).toBeNull();
    expect(screen.getByRole("button", { name: "Kupione (2)" })).toBeVisible();
  });

  it("offers „Usuń wszystkie kupione” only in the expanded section", async () => {
    const { user } = await showList([anItem({ name: "Mleko" }), bought("Chleb")]);

    expect(screen.queryByRole("button", { name: "Usuń wszystkie kupione" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Kupione (1)" }));

    expect(screen.getByRole("button", { name: "Usuń wszystkie kupione" })).toBeVisible();
  });

  it("asks „Usunąć 2 kupionych pozycji?” with focus on „Anuluj”; cancel keeps everything", async () => {
    const items = [anItem({ name: "Mleko" }), bought("Chleb"), bought("Jajka")];
    const { user, list } = await showList(items);
    const requests = clearingSucceeds(list.id, items.slice(1));

    const { open, dialog } = await openClearDialog(user);

    const cancel = within(dialog).getByRole("button", { name: "Anuluj" });
    expect(cancel).toHaveFocus();
    await user.click(cancel);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(open).toHaveFocus();
    expect(screen.getByRole("button", { name: "Kupione (2)" })).toBeVisible();
    expect(requests).toEqual([]);
  });

  it("deletes the bought items after confirmation and keeps the unchecked one", async () => {
    const items = [anItem({ name: "Mleko" }), bought("Chleb"), bought("Jajka")];
    const { user, list } = await showList(items);
    const response = heldResponse();
    const requests = clearingSucceeds(list.id, items.slice(1), response);

    const { dialog } = await openClearDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "Usuń kupione" }));

    expect(within(dialog).getByRole("button", { name: "Usuń kupione" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    response.release();
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });
    expect(screen.queryByRole("button", { name: /^Kupione/ })).toBeNull();
    expect(screen.queryByText("Chleb")).toBeNull();
    expect(
      within(screen.getByRole("list", { name: "Do kupienia" })).getByText("Mleko"),
    ).toBeVisible();
    expect(screen.getByText("1 do kupienia")).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Co kupić?" })).toHaveFocus();
    expect(requests).toEqual(["POST"]);
  });

  // T-020: blokada nie czeka na przerysowanie przycisku w stanie zapisu.
  it("sends one request when confirmed twice before the button re-renders (T-020)", async () => {
    const items = [anItem({ name: "Mleko" }), bought("Chleb"), bought("Jajka")];
    const { user, list } = await showList(items);
    const requests = clearingSucceeds(list.id, items.slice(1));
    const { dialog } = await openClearDialog(user);
    const confirm = within(dialog).getByRole("button", { name: "Usuń kupione" });

    fireEvent.click(confirm);
    fireEvent.click(confirm);

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });
    expect(requests).toEqual(["POST"]);
  });

  it("removes only the items the API deleted (one was unchecked meanwhile)", async () => {
    const items = [bought("Chleb"), bought("Jajka")];
    const { user, list } = await showList(items);
    clearingSucceeds(list.id, items.slice(0, 1));

    const { dialog } = await openClearDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "Usuń kupione" }));

    expect(await screen.findByRole("button", { name: "Kupione (1)" })).toBeVisible();
  });

  it("keeps the dialog open with the save error when the API fails", async () => {
    const items = [bought("Chleb"), bought("Jajka")];
    const { user, list } = await showList(items);
    server.use(
      http.post(`*/api/v1/lists/${list.id}/items/clear-checked`, () =>
        apiError(500, { code: "internal" }),
      ),
    );

    const { dialog } = await openClearDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "Usuń kupione" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Nie udało się zapisać zmiany. Spróbuj ponownie.",
    );
    expect(screen.getByRole("button", { name: "Kupione (2)" })).toBeInTheDocument();
  });
});
