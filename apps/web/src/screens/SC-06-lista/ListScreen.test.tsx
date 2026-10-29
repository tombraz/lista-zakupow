import type { ListSummary } from "@lista/shared";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { aList, ANIA, apiError, detailsOf, TOMEK } from "../../../test/lists";
import { server } from "../../../test/msw-server";
import { renderApp, sessionIs } from "../../../test/render";

function listIs(list: ListSummary) {
  server.use(http.get(`*/api/v1/lists/${list.id}`, () => HttpResponse.json(detailsOf(list))));
}

describe("SC-06 Lista", () => {
  beforeEach(() => {
    sessionIs(ANIA);
  });

  it("shows the list name as h1 and the empty state (AC7)", async () => {
    const list = aList({ name: "Dom" });
    listIs(list);

    renderApp(`/listy/${list.id}`);

    expect(await screen.findByRole("heading", { level: 1, name: "Dom" })).toBeVisible();
    expect(
      await screen.findByText("Lista jest pusta. Dopisz pierwszą rzecz w polu na dole."),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: /Wstecz/ })).toHaveAttribute("href", "/listy");
  });

  it("shows five skeleton rows while loading", async () => {
    const list = aList({ name: "Dom" });
    server.use(
      http.get(`*/api/v1/lists/${list.id}`, async () => {
        await delay(200);
        return HttpResponse.json(detailsOf(list));
      }),
    );

    renderApp(`/listy/${list.id}`);

    await screen.findByRole("link", { name: /Wstecz/ });
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("aria-busy", "true");
    expect(main.querySelectorAll("[data-skeleton]")).toHaveLength(5);
    expect(await screen.findByRole("heading", { level: 1, name: "Dom" })).toBeVisible();
    expect(main).not.toHaveAttribute("aria-busy");
  });

  it("says the list did not load and loads it again on request", async () => {
    const user = userEvent.setup();
    const list = aList({ name: "Dom" });
    listIs(list);
    server.use(
      http.get(`*/api/v1/lists/${list.id}`, () => apiError(500, { code: "internal" }), {
        once: true,
      }),
    );

    renderApp(`/listy/${list.id}`);

    expect(await screen.findByRole("alert")).toHaveTextContent("Nie udało się wczytać listy.");
    await user.click(screen.getByRole("button", { name: "Spróbuj ponownie" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Dom" })).toBeVisible();
  });

  it("shows only „Nie masz dostępu do tej listy.” for someone else's list (SEC3)", async () => {
    const listId = "00000000-0000-7000-8000-00000000abcd";
    server.use(http.get(`*/api/v1/lists/${listId}`, () => apiError(404, { code: "not_found" })));

    renderApp(`/listy/${listId}`);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Nie masz dostępu do tej listy." }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Wróć do moich list" })).toHaveAttribute(
      "href",
      "/listy",
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button", { name: "Więcej opcji" })).toBeNull();
    expect(screen.queryByText(/Lista jest pusta/)).toBeNull();
  });

  describe("menu „Więcej opcji”", () => {
    it("gives the owner rename and delete, and closes on Esc back to the button", async () => {
      const user = userEvent.setup();
      const list = aList({ name: "Dom" });
      listIs(list);
      renderApp(`/listy/${list.id}`);
      const more = await screen.findByRole("button", { name: "Więcej opcji" });
      expect(more).toHaveAttribute("aria-expanded", "false");

      await user.click(more);

      expect(more).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByRole("button", { name: "Zmień nazwę listy" })).toBeVisible();
      expect(screen.getByRole("button", { name: "Usuń listę" })).toBeVisible();

      await user.keyboard("{Escape}");

      expect(more).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByRole("button", { name: "Usuń listę" })).toBeNull();
      expect(more).toHaveFocus();
    });

    it("does not offer a participant rename or delete (SEC2)", async () => {
      const list = aList({ name: "Działka", role: "participant", owner: TOMEK });
      listIs(list);

      renderApp(`/listy/${list.id}`);

      expect(await screen.findByRole("heading", { level: 1, name: "Działka" })).toBeVisible();
      expect(screen.queryByRole("button", { name: "Więcej opcji" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Zmień nazwę listy" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Usuń listę" })).toBeNull();
    });
  });

  describe("rename sheet", () => {
    async function openRename(name = "Dom") {
      const user = userEvent.setup();
      const list = aList({ name });
      listIs(list);
      renderApp(`/listy/${list.id}`);
      await user.click(await screen.findByRole("button", { name: "Więcej opcji" }));
      await user.click(screen.getByRole("button", { name: "Zmień nazwę listy" }));
      return { user, list, sheet: screen.getByRole("dialog", { name: "Zmień nazwę listy" }) };
    }

    it("opens as a modal dialog with the current name in the focused field", async () => {
      const { sheet } = await openRename("Dom");

      expect(sheet).toHaveAttribute("aria-modal", "true");
      const field = within(sheet).getByRole("textbox", { name: "Nazwa listy" });
      expect(field).toHaveValue("Dom");
      expect(field).toHaveFocus();
    });

    it("saves the new name, shows it in the bar and returns focus to „Więcej opcji” (AC6)", async () => {
      const { user, list, sheet } = await openRename("Dom");
      const requests: unknown[] = [];
      server.use(
        http.patch(`*/api/v1/lists/${list.id}`, async ({ request }) => {
          const body = (await request.json()) as { name: string };
          requests.push(body);
          return HttpResponse.json({ ...list, name: body.name });
        }),
      );
      const field = within(sheet).getByRole("textbox", { name: "Nazwa listy" });

      await user.clear(field);
      await user.type(field, "Dom i działka");
      await user.click(within(sheet).getByRole("button", { name: "Zapisz" }));

      expect(await screen.findByRole("heading", { level: 1, name: "Dom i działka" })).toBeVisible();
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(requests).toEqual([{ name: "Dom i działka" }]);
      expect(screen.getByRole("button", { name: "Więcej opcji" })).toHaveFocus();
    });

    it("explains a blank name and closes on Esc without changes (AC2, AC8)", async () => {
      const { user, sheet } = await openRename("Dom");
      const field = within(sheet).getByRole("textbox", { name: "Nazwa listy" });

      await user.clear(field);
      await user.keyboard("{Enter}");
      expect(field).toHaveAccessibleDescription("Wpisz nazwę listy");

      await user.keyboard("{Escape}");

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(screen.getByRole("heading", { level: 1, name: "Dom" })).toBeVisible();
      expect(screen.getByRole("button", { name: "Więcej opcji" })).toHaveFocus();
    });
  });

  describe("delete dialog", () => {
    async function openDelete(overrides: Partial<ListSummary> = {}) {
      const user = userEvent.setup();
      const list = aList({ name: "Dom", ...overrides });
      listIs(list);
      const view = renderApp(`/listy/${list.id}`);
      await user.click(await screen.findByRole("button", { name: "Więcej opcji" }));
      await user.click(screen.getByRole("button", { name: "Usuń listę" }));
      return { user, list, router: view.router, dialog: screen.getByRole("alertdialog") };
    }

    it("asks with the list name and the number of participants, focus on „Anuluj” (AC6)", async () => {
      const { dialog } = await openDelete({
        members: [TOMEK, { id: "u-ola", name: "Ola" }],
      });

      expect(dialog).toHaveAccessibleName("Usunąć listę „Dom”?");
      expect(dialog).toHaveAccessibleDescription("Zniknie też u 2 uczestników.");
      expect(dialog).toHaveAttribute("aria-modal", "true");
      expect(within(dialog).getByRole("button", { name: "Anuluj" })).toHaveFocus();
    });

    it("uses the singular for one participant", async () => {
      expect((await openDelete({ members: [TOMEK] })).dialog).toHaveAccessibleDescription(
        "Zniknie też u 1 uczestnika.",
      );
    });

    it("says it cannot be undone when nobody else uses the list", async () => {
      expect((await openDelete({ members: [] })).dialog).toHaveAccessibleDescription(
        "Tego nie można cofnąć.",
      );
    });

    it("keeps focus inside and closes on Esc back to „Więcej opcji” (AC8)", async () => {
      const { user, dialog } = await openDelete();
      const remove = within(dialog).getByRole("button", { name: "Usuń listę" });
      const cancel = within(dialog).getByRole("button", { name: "Anuluj" });

      await user.tab();
      expect(remove).toHaveFocus();
      await user.tab({ shift: true });
      expect(cancel).toHaveFocus();

      await user.keyboard("{Escape}");

      expect(screen.queryByRole("alertdialog")).toBeNull();
      expect(screen.getByRole("button", { name: "Więcej opcji" })).toHaveFocus();
    });

    it("deletes the list and goes back to „Moje listy” (AC6)", async () => {
      const { user, list, router, dialog } = await openDelete();
      let deleted = 0;
      server.use(
        http.delete(`*/api/v1/lists/${list.id}`, () => {
          deleted += 1;
          return new HttpResponse(null, { status: 204 });
        }),
        http.get("*/api/v1/lists", () => HttpResponse.json([])),
      );

      await user.click(within(dialog).getByRole("button", { name: "Usuń listę" }));

      expect(await screen.findByRole("heading", { level: 1, name: "Moje listy" })).toBeVisible();
      expect(router.state.location.pathname).toBe("/listy");
      expect(deleted).toBe(1);
    });

    // T-015: `disabled` zabrałby fokus z przycisku i z pułapki dialogu (WCAG 2.4.3).
    it("keeps focus on „Usuń listę” inside the dialog while deleting", async () => {
      const { user, list, dialog } = await openDelete();
      server.use(
        http.delete(`*/api/v1/lists/${list.id}`, async () => {
          await delay("infinite");
          return new HttpResponse(null, { status: 204 });
        }),
      );
      const remove = within(dialog).getByRole("button", { name: "Usuń listę" });

      await user.tab();
      await user.keyboard("{Enter}");

      await waitFor(() => {
        expect(remove).toHaveAttribute("aria-busy", "true");
      });
      expect(remove).toHaveAttribute("aria-disabled", "true");
      expect(remove).not.toBeDisabled();
      expect(remove).toHaveFocus();
    });

    it("says the deletion failed and keeps the dialog open", async () => {
      const { user, list, dialog } = await openDelete();
      server.use(
        http.delete(`*/api/v1/lists/${list.id}`, () => apiError(500, { code: "internal" })),
      );

      await user.click(within(dialog).getByRole("button", { name: "Usuń listę" }));

      expect(await within(dialog).findByRole("alert")).toHaveTextContent(
        "Nie udało się zapisać zmiany. Spróbuj ponownie.",
      );
      expect(screen.getByRole("alertdialog")).toBeVisible();
    });
  });
});
