import type { Item, ListSummary } from "@lista/shared";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { aList, anItem, ANIA, apiError, detailsOf, savedItem, TOMEK } from "../../../test/lists";
import { server } from "../../../test/msw-server";
import { heldResponse, type HeldResponse } from "../../../test/held";
import { renderApp, sessionIs } from "../../../test/render";

const CHECKED_AT = "2026-10-28T12:00:00.000Z";

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

const toBuy = () => within(screen.getByRole("list", { name: "Do kupienia" }));
const boughtToggle = () => screen.getByRole("button", { name: /^Kupione \(\d+\)$/ });

function shopping() {
  // Kolejność z API: nieodhaczone od najnowszej.
  return [
    anItem({ name: "Jajka", createdAt: "2026-10-28T10:03:00.000Z" }),
    anItem({ name: "Chleb", addedBy: TOMEK, createdAt: "2026-10-28T10:02:00.000Z" }),
    anItem({ name: "Mleko", createdAt: "2026-10-28T10:01:00.000Z" }),
  ];
}

/** Odpowiedź API scalona z pozycją z listy (MSW zwraca tylko zmienione pola). */
function withFullItems(list: ListSummary, items: Item[], response?: HeldResponse) {
  const requests: unknown[] = [];
  server.use(
    http.patch(`*/api/v1/lists/${list.id}/items/:itemId`, async ({ request, params }) => {
      const { checked } = (await request.json()) as { checked: boolean };
      requests.push({ itemId: params.itemId, checked });
      await response?.released;
      const item = items.find(({ id }) => id === params.itemId) as Item;
      return HttpResponse.json(
        savedItem(item, {
          checked,
          checkedBy: checked ? { id: ANIA.id, name: ANIA.name } : null,
          checkedAt: checked ? CHECKED_AT : null,
        }),
      );
    }),
  );
  return requests;
}

// AC2, AC3 (F-08, F-10): odhaczenie po odpowiedzi API, sekcja „Kupione”, fokus i ogłoszenie.
describe("SC-06 checking an item", () => {
  beforeEach(() => {
    sessionIs(ANIA);
  });

  it("shows checkboxes „Odhacz <nazwa>” and the line „3 do kupienia”", async () => {
    await showList(shopping());

    const checkbox = toBuy().getByRole("button", { name: "Odhacz Chleb" });
    expect(checkbox).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("3 do kupienia")).toBeVisible();
    expect(screen.queryByRole("button", { name: /^Kupione/ })).toBeNull();
  });

  it("keeps the item in „Do kupienia” with a saving checkbox until the API answers", async () => {
    const items = shopping();
    const { user, list } = await showList(items);
    const response = heldResponse();
    const requests = withFullItems(list, items, response);

    await user.click(toBuy().getByRole("button", { name: "Odhacz Chleb" }));

    const saving = toBuy().getByRole("button", { name: "Odhacz Chleb" });
    expect(saving).toHaveAttribute("aria-busy", "true");
    expect(saving).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("3 do kupienia")).toBeVisible();
    response.release();
    await waitFor(() => {
      expect(toBuy().queryByRole("button", { name: "Odhacz Chleb" })).toBeNull();
    });
    expect(requests).toEqual([{ itemId: items[1]?.id, checked: true }]);
  });

  it("ignores a second click on the same item before re-render (one request, T-030)", async () => {
    const items = shopping();
    const { list } = await showList(items);
    const response = heldResponse();
    const requests = withFullItems(list, items, response);

    // Oba kliknięcia w jednym `act`: React przerysowuje dopiero po nim, więc nie chroni ani stan
    // „zapisywanie” w `ItemRow`, ani `useState` w hooku — tylko blokada synchroniczna.
    const checkbox = toBuy().getByRole("button", { name: "Odhacz Chleb" });
    act(() => {
      fireEvent.click(checkbox);
      fireEvent.click(checkbox);
    });
    response.release();

    await screen.findByText("2 do kupienia");
    expect(requests).toEqual([{ itemId: items[1]?.id, checked: true }]);
  });

  it("checks two different items in quick succession (T-030)", async () => {
    const items = shopping();
    const { list } = await showList(items);
    const response = heldResponse();
    const requests = withFullItems(list, items, response);

    fireEvent.click(toBuy().getByRole("button", { name: "Odhacz Chleb" }));
    fireEvent.click(toBuy().getByRole("button", { name: "Odhacz Mleko" }));
    response.release();

    await screen.findByText("1 do kupienia");
    // Kolejność odbioru w MSW nie jest gwarantowana (asynchroniczne `request.json()`).
    expect(requests).toHaveLength(2);
    expect(requests).toEqual(
      expect.arrayContaining([
        { itemId: items[1]?.id, checked: true },
        { itemId: items[2]?.id, checked: true },
      ]),
    );
    expect(boughtToggle()).toHaveAccessibleName("Kupione (2)");
    // Ogłoszenie ostatniej odpowiedzi; kolejność odpowiedzi jak wyżej.
    expect(screen.getByText(/^Odhaczono (Chleb|Mleko)$/)).toBeInTheDocument();
  });

  it("moves the checked item to the collapsed „Kupione (1)”, struck through and signed", async () => {
    const items = shopping();
    const { user, list } = await showList(items);
    withFullItems(list, items);

    await user.click(toBuy().getByRole("button", { name: "Odhacz Chleb" }));

    expect(await screen.findByText("2 do kupienia")).toBeVisible();
    expect(toBuy().queryByText("Chleb")).toBeNull();
    const toggle = boughtToggle();
    expect(toggle).toHaveAccessibleName("Kupione (1)");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("list", { name: "Kupione" })).toBeNull();

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const bought = within(screen.getByRole("list", { name: "Kupione" }));
    const uncheck = bought.getByRole("button", { name: "Odznacz Chleb" });
    expect(uncheck).toHaveAttribute("aria-pressed", "true");
    expect(bought.getByText("kupił(a) Ania")).toBeVisible();
    expect(bought.getByRole("button", { name: "Edytuj Chleb" }).closest("li")).toHaveAttribute(
      "data-checked",
      "true",
    );
  });

  it("moves focus to the next unchecked item and announces „Odhaczono Chleb”", async () => {
    const items = shopping();
    const { user, list } = await showList(items);
    withFullItems(list, items);

    toBuy().getByRole("button", { name: "Odhacz Chleb" }).focus();
    await user.keyboard(" ");

    await screen.findByText("2 do kupienia");
    expect(toBuy().getByRole("button", { name: "Odhacz Mleko" })).toHaveFocus();
    expect(screen.getByText("Odhaczono Chleb")).toBeInTheDocument();
  });

  it("moves focus to the previous item when the last one was checked", async () => {
    const items = shopping();
    const { user, list } = await showList(items);
    withFullItems(list, items);

    await user.click(toBuy().getByRole("button", { name: "Odhacz Mleko" }));

    await screen.findByText("2 do kupienia");
    expect(toBuy().getByRole("button", { name: "Odhacz Chleb" })).toHaveFocus();
  });

  it("orders bought items from the most recently checked (API order)", async () => {
    const bought = [
      anItem({ name: "Masło", checked: true, checkedBy: TOMEK, checkedAt: CHECKED_AT }),
      anItem({
        name: "Ser",
        checked: true,
        checkedBy: TOMEK,
        checkedAt: "2026-10-28T11:00:00.000Z",
      }),
    ];
    const { user } = await showList([anItem({ name: "Mleko" }), ...bought]);

    await user.click(boughtToggle());

    const names = within(screen.getByRole("list", { name: "Kupione" }))
      .getAllByRole("button", { name: /^Edytuj/ })
      .map((button) => button.textContent);
    expect(names).toEqual(["Masło", "Ser"]);
    expect(screen.getAllByText("kupił(a) Tomek")).toHaveLength(2);
  });

  it("unchecks a bought item back to „Do kupienia” signed „dodał(a) …”", async () => {
    const bread = anItem({ name: "Chleb", checked: true, checkedBy: ANIA, checkedAt: CHECKED_AT });
    const items = [anItem({ name: "Mleko" }), bread];
    const { user, list } = await showList(items);
    const requests = withFullItems(list, items);

    await user.click(boughtToggle());
    await user.click(screen.getByRole("button", { name: "Odznacz Chleb" }));

    expect(await toBuy().findByRole("button", { name: "Odhacz Chleb" })).toBeVisible();
    expect(screen.getByText("2 do kupienia")).toBeVisible();
    expect(toBuy().getAllByText("dodał(a) Ania")).toHaveLength(2);
    expect(requests).toEqual([{ itemId: bread.id, checked: false }]);
  });

  it("shows the save error and keeps the item unchecked when the API fails", async () => {
    const { user, list } = await showList(shopping());
    server.use(
      http.patch(`*/api/v1/lists/${list.id}/items/:itemId`, () =>
        apiError(500, { code: "internal" }),
      ),
    );

    await user.click(toBuy().getByRole("button", { name: "Odhacz Chleb" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Nie udało się zapisać zmiany. Spróbuj ponownie.",
    );
    const checkbox = toBuy().getByRole("button", { name: "Odhacz Chleb" });
    expect(checkbox).toHaveAttribute("aria-pressed", "false");
    expect(checkbox).not.toHaveAttribute("aria-busy");
    expect(screen.getByText("3 do kupienia")).toBeVisible();
  });

  it("refreshes the list when the item was deleted by someone else (404)", async () => {
    const items = shopping();
    const { user, list } = await showList(items);
    let served = 0;
    server.use(
      http.patch(`*/api/v1/lists/${list.id}/items/:itemId`, () =>
        apiError(404, { code: "not_found" }),
      ),
      http.get(`*/api/v1/lists/${list.id}`, () => {
        served += 1;
        return HttpResponse.json(detailsOf(list, [items[0] as Item, items[2] as Item]));
      }),
    );

    await user.click(toBuy().getByRole("button", { name: "Odhacz Chleb" }));

    await waitFor(() => {
      expect(toBuy().queryByText("Chleb")).toBeNull();
    });
    expect(served).toBeGreaterThan(0);
    expect(screen.getByText("2 do kupienia")).toBeVisible();
  });
});
