import type { Item, ListSummary } from "@lista/shared";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { aList, anItem, ANIA, apiError, detailsOf } from "../../../test/lists";
import { server } from "../../../test/msw-server";
import { renderApp, sessionIs } from "../../../test/render";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function listIs(list: ListSummary, items: Item[] = []) {
  server.use(
    http.get(`*/api/v1/lists/${list.id}`, () => HttpResponse.json(detailsOf(list, items))),
  );
}

/** `POST …/items` odpowiada pozycją zbudowaną z treści żądania; zwraca odebrane treści. */
function addingSucceeds(list: ListSummary, wait = 0) {
  const requests: Record<string, unknown>[] = [];
  server.use(
    http.post(`*/api/v1/lists/${list.id}/items`, async ({ request }) => {
      const body = (await request.json()) as { id: string; name: string; note?: string };
      requests.push(body);
      await delay(wait);
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
    const requests = addingSucceeds(list, 100);

    await user.type(name, "Mleko");
    await user.type(screen.getByRole("textbox", { name: "Ilość / notatka (opcjonalnie)" }), "2 l");
    await user.click(screen.getByRole("button", { name: "Dodaj pozycję" }));

    expect(screen.getByRole("button", { name: "Dodaj pozycję" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.queryByRole("button", { name: "Edytuj Mleko" })).toBeNull();
    expect(await screen.findByRole("button", { name: "Edytuj Mleko" })).toBeVisible();
    const rows = within(screen.getByRole("list", { name: "Do kupienia" })).getAllByRole("listitem");
    expect(rows.map((row) => within(row).getByRole("button").textContent)).toEqual([
      "Mleko",
      "Chleb",
    ]);
    expect(name).toHaveValue("");
    expect(name).toHaveFocus();
    expect(screen.getByText("Dodano Mleko")).toHaveAttribute("role", "status");
    expect(requests).toHaveLength(1);
    const [{ id, ...sent } = {}] = requests;
    expect(id).toMatch(UUID);
    expect(sent).toEqual({ name: "Mleko", note: "2 l" });
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
    const items = Array.from({ length: 500 }, (_, index) => anItem({ name: `P${String(index)}` }));
    await openList(items);

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
