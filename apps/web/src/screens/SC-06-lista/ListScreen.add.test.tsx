import type { Item, ListSummary } from "@lista/shared";
import { focusManager } from "@tanstack/react-query";
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { aList, anItem, ANIA, apiError, detailsOf } from "../../../test/lists";
import { server } from "../../../test/msw-server";
import { heldResponse, type HeldResponse } from "../../../test/held";
import { renderApp, sessionIs } from "../../../test/render";

const LIMIT = "Lista ma 500 pozycji — to limit. Usuń kupione albo niepotrzebne pozycje.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function listIs(list: ListSummary, items: Item[] = []) {
  server.use(
    http.get(`*/api/v1/lists/${list.id}`, () => HttpResponse.json(detailsOf(list, items))),
  );
}

/** `POST …/items` odpowiada pozycją zbudowaną z treści żądania; zwraca odebrane treści. */
function addingSucceeds(list: ListSummary, response?: HeldResponse) {
  const requests: Record<string, unknown>[] = [];
  server.use(
    http.post(`*/api/v1/lists/${list.id}/items`, async ({ request }) => {
      const body = (await request.json()) as { id: string; name: string; note?: string };
      requests.push(body);
      await response?.released;
      return HttpResponse.json(anItem({ id: body.id, name: body.name, note: body.note ?? null }), {
        status: 201,
      });
    }),
  );
  return requests;
}

async function openList(items: Item[] = []) {
  const user = userEvent.setup();
  const list = aList({ name: "Dom" });
  listIs(list, items);
  renderApp(`/listy/${list.id}`);
  await screen.findByRole("heading", { level: 1, name: "Dom" });
  const name = screen.getByRole("textbox", { name: "Co kupić?" });
  return { user, list, name };
}

describe("SC-06 AddBar", () => {
  beforeEach(() => {
    sessionIs(ANIA);
  });

  it("adds an item after the API answers: saving, on top, fields cleared, focus kept, announced (AC1)", async () => {
    const older = anItem({ name: "Chleb" });
    const { user, list, name } = await openList([older]);
    const response = heldResponse();
    const requests = addingSucceeds(list, response);

    await user.type(name, "Mleko");
    await user.type(screen.getByRole("textbox", { name: "Ilość / notatka (opcjonalnie)" }), "2 l");
    await user.click(screen.getByRole("button", { name: "Dodaj pozycję" }));

    expect(screen.getByRole("button", { name: "Dodaj pozycję" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.queryByRole("button", { name: "Edytuj Mleko" })).toBeNull();
    response.release();
    expect(await screen.findByRole("button", { name: "Edytuj Mleko" })).toBeVisible();
    const rows = within(screen.getByRole("list", { name: "Do kupienia" })).getAllByRole("listitem");
    expect(
      rows.map((row) => within(row).getByRole("button", { name: /^Edytuj / }).textContent),
    ).toEqual(["Mleko", "Chleb"]);
    expect(name).toHaveValue("");
    expect(name).toHaveFocus();
    expect(screen.getByText("Dodano Mleko")).toHaveAttribute("role", "status");
    expect(requests).toHaveLength(1);
    const [{ id, ...sent } = {}] = requests;
    expect(id).toMatch(UUID);
    expect(sent).toEqual({ name: "Mleko", note: "2 l" });
  });

  it("focuses the add field when an empty list opens (SC-06 Empty, T-011)", async () => {
    const { name } = await openList();

    expect(
      screen.getByText("Lista jest pusta. Dopisz pierwszą rzecz w polu na dole."),
    ).toBeVisible();
    expect(name).toHaveFocus();
  });

  it("leaves focus alone when a list with items opens (T-011)", async () => {
    const { name } = await openList([anItem({ name: "Chleb" })]);

    expect(screen.getByRole("button", { name: "Edytuj Chleb" })).toBeVisible();
    expect(name).not.toHaveFocus();
  });

  it("does not move focus when the list becomes empty after a refresh (T-011)", async () => {
    const { list, name } = await openList([anItem({ name: "Chleb" })]);
    const back = screen.getByRole("link", { name: "Wstecz" });
    back.focus();
    listIs(list);

    // Odświeżenie jak po powrocie do karty: ktoś inny usunął ostatnią pozycję.
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });

    expect(
      await screen.findByText("Lista jest pusta. Dopisz pierwszą rzecz w polu na dole."),
    ).toBeVisible();
    expect(back).toHaveFocus();
    expect(name).not.toHaveFocus();
  });
});

describe("SC-06 AddBar warnings", () => {
  beforeEach(() => {
    sessionIs(ANIA);
  });

  it("warns about „mleko” when „Mleko” is on the list, keeps the text, sends nothing (AC2)", async () => {
    const { user, list, name } = await openList([anItem({ name: "Mleko" })]);
    const requests = addingSucceeds(list);

    await user.type(name, "mleko{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "„Mleko” jest już na liście. Pozycja nie została dodana.",
    );
    expect(name).toHaveValue("mleko");
    expect(requests).toEqual([]);
  });

  it("shows the warning when the API finds a duplicate added meanwhile (AC2)", async () => {
    const { user, list, name } = await openList();
    server.use(
      http.post(`*/api/v1/lists/${list.id}/items`, () => apiError(409, { code: "duplicate_item" })),
    );

    await user.type(name, " Mleko {Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "„Mleko” jest już na liście. Pozycja nie została dodana.",
    );
    expect(name).toHaveValue(" Mleko ");
  });

  it("adds „Mleko owsiane” next to „Mleko” without a warning (AC2)", async () => {
    const { user, list, name } = await openList([anItem({ name: "Mleko" })]);
    addingSucceeds(list);

    await user.type(name, "Mleko owsiane{Enter}");

    expect(await screen.findByRole("button", { name: "Edytuj Mleko owsiane" })).toBeVisible();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("explains a too long name and note under the fields without sending (AC4)", async () => {
    const { user, list, name } = await openList();
    const requests = addingSucceeds(list);

    await user.click(name);
    await user.paste("a".repeat(101));
    await user.click(screen.getByRole("textbox", { name: "Ilość / notatka (opcjonalnie)" }));
    await user.paste("n".repeat(201));
    await user.click(screen.getByRole("button", { name: "Dodaj pozycję" }));

    expect(name).toHaveAccessibleDescription("Nazwa może mieć najwyżej 100 znaków");
    expect(
      screen.getByRole("textbox", { name: "Ilość / notatka (opcjonalnie)" }),
    ).toHaveAccessibleDescription("Notatka może mieć najwyżej 200 znaków");
    expect(requests).toEqual([]);
  });

  it("shows the API's field error under the name (AC4)", async () => {
    const { user, list, name } = await openList();
    server.use(
      http.post(`*/api/v1/lists/${list.id}/items`, () =>
        apiError(400, { code: "validation_failed", fields: { name: "too_long" } }),
      ),
    );

    await user.type(name, "Mleko{Enter}");

    await expect.poll(() => name.getAttribute("aria-invalid")).toBe("true");
    expect(name).toHaveAccessibleDescription("Nazwa może mieć najwyżej 100 znaków");
  });

  it("shows the limit and disables the AddBar at 500 items (AC5)", async () => {
    // Limit liczy też kupione; zwinięte „Kupione” się nie renderują, więc test nie płaci
    // za 500 wierszy w jsdom (~2 s, T-021).
    const bought = Array.from({ length: 499 }, (_, index) =>
      anItem({ name: `P${String(index)}`, checked: true }),
    );
    await openList([anItem({ name: "Mleko" }), ...bought]);

    expect(
      screen.getByText("Lista ma 500 pozycji — to limit. Usuń kupione albo niepotrzebne pozycje."),
    ).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Co kupić?" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Dodaj pozycję" })).toBeDisabled();
  });

  it("shows the limit when the API says the list is full (AC5)", async () => {
    const { user, list, name } = await openList();
    server.use(
      http.post(`*/api/v1/lists/${list.id}/items`, () =>
        apiError(409, { code: "limit_reached", limit: "items" }),
      ),
    );

    await user.type(name, "Mleko{Enter}");

    expect(
      await screen.findByText(
        "Lista ma 500 pozycji — to limit. Usuń kupione albo niepotrzebne pozycje.",
      ),
    ).toBeVisible();
    expect(name).toBeDisabled();
  });

  // T-023: pole i „Dodaj” dostają `disabled`, więc fokus z nich spada na `body` (WCAG 2.4.3);
  // przechodzi na ostrzeżenie o limicie. jsdom nie zdejmuje fokusu z `disabled` — w przeglądarce
  // sprawdza to E2E J-03.
  it("moves focus to the limit warning when the own 500th item is added (T-023 AC1)", async () => {
    const bought = Array.from({ length: 498 }, (_, index) =>
      anItem({ name: `P${String(index)}`, checked: true }),
    );
    const { user, list, name } = await openList([anItem({ name: "Chleb" }), ...bought]);
    addingSucceeds(list);

    await user.type(name, "Mleko{Enter}");

    const limit = await screen.findByText(LIMIT);
    expect(limit.closest('[role="status"]')).toHaveFocus();
    expect(name).toBeDisabled();
  });

  it("moves focus to the limit warning when the API says the list is full (T-023 AC1)", async () => {
    const { user, list, name } = await openList();
    server.use(
      http.post(`*/api/v1/lists/${list.id}/items`, () =>
        apiError(409, { code: "limit_reached", limit: "items" }),
      ),
    );

    await user.type(name, "Mleko{Enter}");

    const limit = await screen.findByText(LIMIT);
    expect(limit.closest('[role="status"]')).toHaveFocus();
  });

  it("leaves focus on the heading when the list opens already full (T-023 AC2)", async () => {
    const bought = Array.from({ length: 499 }, (_, index) =>
      anItem({ name: `P${String(index)}`, checked: true }),
    );
    await openList([anItem({ name: "Mleko" }), ...bought]);

    await expect
      .poll(() => document.activeElement)
      .toBe(screen.getByRole("heading", { level: 1, name: "Dom" }));
    expect(screen.getByText(LIMIT).closest('[role="status"]')).not.toHaveFocus();
  });

  it("says the save failed and keeps the text (Error — zapis)", async () => {
    const { user, list, name } = await openList();
    server.use(
      http.post(`*/api/v1/lists/${list.id}/items`, () => apiError(500, { code: "internal" })),
    );

    await user.type(name, "Mleko{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Nie udało się zapisać zmiany. Spróbuj ponownie.",
    );
    expect(name).toHaveValue("Mleko");
    expect(screen.queryByRole("button", { name: "Edytuj Mleko" })).toBeNull();
  });
});

describe("SC-06 AddBar while saving and after a failed save", () => {
  beforeEach(() => {
    sessionIs(ANIA);
  });

  it("keeps text typed while the previous item is saving and adds it next (QA round 1 #1)", async () => {
    const { user, list, name } = await openList();
    const response = heldResponse();
    const requests = addingSucceeds(list, response);

    await user.type(name, "Mleko{Enter}");
    await user.clear(name);
    await user.type(name, "Chleb");
    response.release();

    expect(await screen.findByRole("button", { name: "Edytuj Mleko" })).toBeVisible();
    expect(name).toHaveValue("Chleb");

    await user.type(name, "{Enter}");

    expect(await screen.findByRole("button", { name: "Edytuj Chleb" })).toBeVisible();
    expect(requests.map(({ name: sent }) => sent)).toEqual(["Mleko", "Chleb"]);
    expect(requests[1]?.["id"]).not.toBe(requests[0]?.["id"]);
  });

  it("sends nothing when Enter is pressed while the previous item is saving (T-029)", async () => {
    const { user, list, name } = await openList();
    const response = heldResponse();
    const requests = addingSucceeds(list, response);

    await user.type(name, "Mleko{Enter}");
    await user.clear(name);
    await user.type(name, "Chleb{Enter}");
    response.release();

    expect(await screen.findByRole("button", { name: "Edytuj Mleko" })).toBeVisible();
    expect(screen.getByText("Dodano Mleko")).toHaveAttribute("role", "status");
    expect(name).toHaveValue("Chleb");
    expect(requests.map(({ name: sent }) => sent)).toEqual(["Mleko"]);
  });

  it("sends a new id when the text changed after a lost response (QA round 1 #2)", async () => {
    const { user, list, name } = await openList();
    const saved = new Map<string, Item>();
    const ids: string[] = [];
    server.use(
      http.post(`*/api/v1/lists/${list.id}/items`, async ({ request }) => {
        const body = (await request.json()) as { id: string; name: string };
        ids.push(body.id);
        const known = saved.get(body.id);
        if (known) return HttpResponse.json(known);
        saved.set(body.id, anItem({ id: body.id, name: body.name }));
        // Serwer zapisał, ale odpowiedź przepadła.
        return ids.length === 1
          ? HttpResponse.error()
          : HttpResponse.json(saved.get(body.id), { status: 201 });
      }),
    );

    await user.type(name, "Ser{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent(/połączenia/i);
    await user.clear(name);
    await user.type(name, "Jajka{Enter}");

    expect(await screen.findByRole("button", { name: "Edytuj Jajka" })).toBeVisible();
    expect(screen.getByText("Dodano Jajka")).toBeVisible();
    expect(ids).toHaveLength(2);
    expect(ids[1]).not.toBe(ids[0]);
  });

  it("repeats the same id when the unchanged text is sent again (AC6)", async () => {
    const { user, list, name } = await openList();
    const ids: string[] = [];
    server.use(
      http.post(`*/api/v1/lists/${list.id}/items`, async ({ request }) => {
        const body = (await request.json()) as { id: string; name: string };
        ids.push(body.id);
        return ids.length === 1
          ? HttpResponse.error()
          : HttpResponse.json(anItem({ id: body.id, name: body.name }), { status: 201 });
      }),
    );

    await user.type(name, "Ser{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent(/połączenia/i);
    await user.type(name, "{Enter}");

    expect(await screen.findByRole("button", { name: "Edytuj Ser" })).toBeVisible();
    expect(ids).toHaveLength(2);
    expect(ids[1]).toBe(ids[0]);
  });

  it("enables the AddBar again when an item is deleted after the API's limit (QA round 1 #3)", async () => {
    const { user, list, name } = await openList([anItem({ name: "Chleb" })]);
    server.use(
      http.post(`*/api/v1/lists/${list.id}/items`, () =>
        apiError(409, { code: "limit_reached", limit: "items" }),
      ),
      http.delete(
        `*/api/v1/lists/${list.id}/items/:itemId`,
        () => new HttpResponse(null, { status: 204 }),
      ),
    );
    const limit = "Lista ma 500 pozycji — to limit. Usuń kupione albo niepotrzebne pozycje.";

    await user.type(name, "Mleko{Enter}");
    expect(await screen.findByText(limit)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Edytuj Chleb" }));
    await user.click(screen.getByRole("button", { name: "Usuń pozycję" }));

    await expect.poll(() => screen.queryByRole("button", { name: "Edytuj Chleb" })).toBeNull();
    expect(screen.queryByText(limit)).toBeNull();
    expect(name).toBeEnabled();
    expect(screen.getByRole("button", { name: "Dodaj pozycję" })).toBeEnabled();
  });
});
