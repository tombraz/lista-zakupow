import type { Item, ListSummary } from "@lista/shared";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { aList, anItem, ANIA, apiError, detailsOf, savedItem } from "../../../test/lists";
import { server } from "../../../test/msw-server";
import { renderApp, sessionIs } from "../../../test/render";

const NOTE = "Ilość / notatka (opcjonalnie)";

async function openSheet(items: Item[], itemName: string) {
  const user = userEvent.setup();
  const list = aList({ name: "Dom" });
  server.use(
    http.get(`*/api/v1/lists/${list.id}`, () => HttpResponse.json(detailsOf(list, items))),
  );
  renderApp(`/listy/${list.id}`);
  const trigger = await screen.findByRole("button", { name: `Edytuj ${itemName}` });
  await user.click(trigger);
  const sheet = screen.getByRole("dialog", { name: "Edytuj pozycję" });
  return { user, list, trigger, sheet };
}

/** `PATCH …/items/:itemId` zapisuje zmiany; zwraca odebrane treści. */
function savingSucceeds(list: ListSummary, item: Item) {
  const requests: unknown[] = [];
  server.use(
    http.patch(`*/api/v1/lists/${list.id}/items/${item.id}`, async ({ request }) => {
      const changes = (await request.json()) as Partial<Item>;
      requests.push(changes);
      return HttpResponse.json(savedItem(item, changes));
    }),
  );
  return requests;
}

describe("SC-06 sheet „Edytuj pozycję”", () => {
  beforeEach(() => {
    sessionIs(ANIA);
  });

  it("opens as a modal dialog with the item's name focused and its note", async () => {
    const milk = anItem({ name: "Mleko", note: "2 l" });
    const { sheet } = await openSheet([milk], "Mleko");

    expect(sheet).toHaveAttribute("aria-modal", "true");
    const name = within(sheet).getByRole("textbox", { name: "Nazwa" });
    expect(name).toHaveValue("Mleko");
    expect(name).toHaveFocus();
    expect(within(sheet).getByRole("textbox", { name: NOTE })).toHaveValue("2 l");
  });

  it("saves only the changed note, shows it and returns focus to the item (AC3)", async () => {
    const milk = anItem({ name: "Mleko", note: null });
    const { user, list, sheet } = await openSheet([milk], "Mleko");
    const requests = savingSucceeds(list, milk);

    await user.type(within(sheet).getByRole("textbox", { name: NOTE }), "2 l");
    await user.click(within(sheet).getByRole("button", { name: "Zapisz" }));

    expect(await screen.findByText("2 l · dodał(a) Ania")).toBeVisible();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(requests).toEqual([{ note: "2 l" }]);
    expect(screen.getByRole("button", { name: "Edytuj Mleko" })).toHaveFocus();
  });

  it("refuses to rename „Masło” to „mleko” when „Mleko” is on the list (AC3)", async () => {
    const milk = anItem({ name: "Mleko" });
    const butter = anItem({ name: "Masło" });
    const { user, list, sheet } = await openSheet([milk, butter], "Masło");
    const requests = savingSucceeds(list, butter);
    const name = within(sheet).getByRole("textbox", { name: "Nazwa" });

    await user.clear(name);
    await user.type(name, "mleko{Enter}");

    expect(await within(sheet).findByRole("alert")).toHaveTextContent(
      "Na liście jest już pozycja „Mleko”. Wybierz inną nazwę.",
    );
    expect(requests).toEqual([]);
    expect(name).toHaveValue("mleko");
  });

  it("shows the rename warning when the API finds the duplicate (AC3)", async () => {
    const butter = anItem({ name: "Masło" });
    const { user, list, sheet } = await openSheet([butter], "Masło");
    server.use(
      http.patch(`*/api/v1/lists/${list.id}/items/${butter.id}`, () =>
        apiError(409, { code: "duplicate_item" }),
      ),
    );
    const name = within(sheet).getByRole("textbox", { name: "Nazwa" });

    await user.clear(name);
    await user.type(name, "Mleko{Enter}");

    expect(await within(sheet).findByRole("alert")).toHaveTextContent(
      "Na liście jest już pozycja „Mleko”. Wybierz inną nazwę.",
    );
    expect(screen.getByRole("dialog")).toBeVisible();
  });

  it("saves „Mleko” renamed to „mleko” — not a duplicate of itself (AC3)", async () => {
    const milk = anItem({ name: "Mleko" });
    const { user, list, sheet } = await openSheet([milk], "Mleko");
    const requests = savingSucceeds(list, milk);
    const name = within(sheet).getByRole("textbox", { name: "Nazwa" });

    await user.clear(name);
    await user.type(name, "mleko{Enter}");

    expect(await screen.findByRole("button", { name: "Edytuj mleko" })).toHaveFocus();
    expect(requests).toEqual([{ name: "mleko" }]);
  });

  it("explains a too long name under the field without sending (AC4)", async () => {
    const milk = anItem({ name: "Mleko" });
    const { user, list, sheet } = await openSheet([milk], "Mleko");
    const requests = savingSucceeds(list, milk);
    const name = within(sheet).getByRole("textbox", { name: "Nazwa" });

    await user.clear(name);
    await user.paste("a".repeat(101));
    await user.click(within(sheet).getByRole("button", { name: "Zapisz" }));

    expect(name).toHaveAccessibleDescription("Nazwa może mieć najwyżej 100 znaków");
    expect(requests).toEqual([]);
  });

  it("says the save failed and keeps the sheet open", async () => {
    const milk = anItem({ name: "Mleko" });
    const { user, list, sheet } = await openSheet([milk], "Mleko");
    server.use(
      http.patch(`*/api/v1/lists/${list.id}/items/${milk.id}`, () =>
        apiError(500, { code: "internal" }),
      ),
    );

    await user.type(within(sheet).getByRole("textbox", { name: NOTE }), "2 l{Enter}");

    expect(await within(sheet).findByRole("alert")).toHaveTextContent(
      "Nie udało się zapisać zmiany. Spróbuj ponownie.",
    );
  });

  it("closes on Esc without changes and returns focus to the item (AC9)", async () => {
    const milk = anItem({ name: "Mleko" });
    const { user, trigger } = await openSheet([milk], "Mleko");

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
  });
});

describe("SC-06 deleting an item", () => {
  beforeEach(() => {
    sessionIs(ANIA);
  });

  function deletingSucceeds(list: ListSummary) {
    const deleted: string[] = [];
    server.use(
      http.delete(`*/api/v1/lists/${list.id}/items/:itemId`, ({ params }) => {
        deleted.push(String(params["itemId"]));
        return new HttpResponse(null, { status: 204 });
      }),
    );
    return deleted;
  }

  const [milk, bread, cheese] = [
    anItem({ name: "Mleko" }),
    anItem({ name: "Chleb" }),
    anItem({ name: "Ser" }),
  ];

  it.each([
    ["the next item", "Chleb", "Edytuj Ser"],
    ["the previous item when it was the last", "Ser", "Edytuj Chleb"],
  ])("deletes at once and moves focus to %s (AC7)", async (_case, name, focused) => {
    const { user, list, sheet } = await openSheet([milk, bread, cheese], name);
    const deleted = deletingSucceeds(list);

    await user.click(within(sheet).getByRole("button", { name: "Usuń pozycję" }));

    expect(await screen.findByRole("button", { name: focused })).toHaveFocus();
    expect(screen.queryByRole("button", { name: `Edytuj ${name}` })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(deleted).toHaveLength(1);
  });

  it("moves focus to „Co kupić?” after deleting the only item (AC7)", async () => {
    const { user, list, sheet } = await openSheet([milk], "Mleko");
    deletingSucceeds(list);

    await user.click(within(sheet).getByRole("button", { name: "Usuń pozycję" }));

    expect(
      await screen.findByText("Lista jest pusta. Dopisz pierwszą rzecz w polu na dole."),
    ).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Co kupić?" })).toHaveFocus();
  });

  it("says the item was deleted by someone else when saving it, and „Zamknij” removes it (AC7)", async () => {
    const { user, list, sheet } = await openSheet([milk, bread], "Mleko");
    server.use(
      http.patch(`*/api/v1/lists/${list.id}/items/${milk.id}`, () =>
        apiError(404, { code: "not_found" }),
      ),
    );

    await user.type(within(sheet).getByRole("textbox", { name: NOTE }), "2 l{Enter}");

    expect(
      await within(sheet).findByText("Ta pozycja została usunięta przez inną osobę."),
    ).toBeVisible();
    await user.click(within(sheet).getByRole("button", { name: "Zamknij" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button", { name: "Edytuj Mleko" })).toBeNull();
    expect(screen.getByRole("button", { name: "Edytuj Chleb" })).toHaveFocus();
  });
});
