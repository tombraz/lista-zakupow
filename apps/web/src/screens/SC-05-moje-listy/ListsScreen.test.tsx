import { screen, within } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { aList, ANIA, apiError, detailsOf, listsAre, TOMEK } from "../../../test/lists";
import { server } from "../../../test/msw-server";
import { renderApp, sessionIs } from "../../../test/render";

describe("SC-05 Moje listy", () => {
  beforeEach(() => {
    sessionIs(ANIA);
  });

  it("explains the empty state and offers to create the first list (AC5)", async () => {
    listsAre([]);

    renderApp("/listy");

    expect(await screen.findByText("Nie masz jeszcze żadnej listy.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Utwórz pierwszą listę" })).toBeVisible();
    expect(screen.getByRole("heading", { level: 1, name: "Moje listy" })).toBeVisible();
  });

  it("shows three skeleton cards and a busy region while loading (AC5)", async () => {
    server.use(
      http.get("*/api/v1/lists", async () => {
        await delay(200);
        return HttpResponse.json([aList({ name: "Dom" })]);
      }),
    );

    renderApp("/listy");

    await screen.findByRole("heading", { level: 1, name: "Moje listy" });
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("aria-busy", "true");
    expect(main.querySelectorAll("[data-skeleton]")).toHaveLength(3);
    expect(await screen.findByRole("link", { name: /Dom/ })).toBeVisible();
    expect(main).not.toHaveAttribute("aria-busy");
  });

  it("says the lists did not load and loads them again on request (AC5)", async () => {
    const user = userEvent.setup();
    listsAre([aList({ name: "Dom" })]);
    server.use(
      http.get("*/api/v1/lists", () => apiError(500, { code: "internal" }), { once: true }),
    );

    renderApp("/listy");

    expect(await screen.findByRole("alert")).toHaveTextContent("Nie udało się wczytać list.");
    await user.click(screen.getByRole("button", { name: "Spróbuj ponownie" }));
    expect(await screen.findByRole("link", { name: /Dom/ })).toBeVisible();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows own and shared lists as links, the shared one with its owner (AC4)", async () => {
    const own = aList({ name: "Dom", toBuyCount: 3, members: [TOMEK] });
    const shared = aList({ name: "Działka", role: "participant", owner: TOMEK });
    listsAre([own, shared]);

    renderApp("/listy");

    const cards = within(await screen.findByRole("list")).getAllByRole("link");
    expect(cards.map((card) => card.getAttribute("aria-label"))).toEqual([
      "Dom, 3 do kupienia",
      "Działka, udostępniona przez Tomek, 0 do kupienia",
    ]);
    expect(cards[0]).toHaveAttribute("href", `/listy/${own.id}`);
    expect(within(cards[1] as HTMLElement).getByText("od Tomek")).toBeVisible();
    expect(within(cards[0] as HTMLElement).queryByText(/^od /)).toBeNull();
  });

  describe("new list form", () => {
    it("opens in place of the button with focus in the name field (AC8)", async () => {
      const user = userEvent.setup();
      listsAre([aList({ name: "Dom" })]);
      renderApp("/listy");

      await user.click(await screen.findByRole("button", { name: "+ Nowa lista" }));

      expect(screen.getByRole("textbox", { name: "Nazwa listy" })).toHaveFocus();
      expect(screen.getByRole("textbox", { name: "Nazwa listy" })).toHaveAttribute(
        "placeholder",
        "np. Zakupy na tydzień",
      );
      expect(screen.queryByRole("button", { name: "+ Nowa lista" })).toBeNull();
    });

    it("creates the list from the empty state and opens it (AC1)", async () => {
      const user = userEvent.setup();
      const created = aList({ name: "Zakupy" });
      const requests: unknown[] = [];
      listsAre([]);
      server.use(
        http.post("*/api/v1/lists", async ({ request }) => {
          requests.push(await request.json());
          return HttpResponse.json(created, { status: 201 });
        }),
        http.get(`*/api/v1/lists/${created.id}`, () => HttpResponse.json(detailsOf(created))),
      );
      const { router } = renderApp("/listy");

      await user.click(await screen.findByRole("button", { name: "Utwórz pierwszą listę" }));
      await user.type(screen.getByRole("textbox", { name: "Nazwa listy" }), "Zakupy{Enter}");

      expect(await screen.findByRole("heading", { level: 1, name: "Zakupy" })).toBeVisible();
      expect(router.state.location.pathname).toBe(`/listy/${created.id}`);
      expect(requests).toEqual([{ name: "Zakupy" }]);
    });

    it("closes on „Anuluj” or Esc and returns focus to the button (AC8)", async () => {
      const user = userEvent.setup();
      listsAre([aList({ name: "Dom" })]);
      renderApp("/listy");

      await user.click(await screen.findByRole("button", { name: "+ Nowa lista" }));
      await user.click(screen.getByRole("button", { name: "Anuluj" }));

      expect(screen.queryByRole("textbox", { name: "Nazwa listy" })).toBeNull();
      expect(screen.getByRole("button", { name: "+ Nowa lista" })).toHaveFocus();

      await user.keyboard("{Enter}");
      await user.type(screen.getByRole("textbox", { name: "Nazwa listy" }), "Szkic");
      await user.keyboard("{Escape}");

      expect(screen.queryByRole("textbox", { name: "Nazwa listy" })).toBeNull();
      expect(screen.getByRole("button", { name: "+ Nowa lista" })).toHaveFocus();
    });

    it("explains a blank or too long name at the field and sends nothing (AC2)", async () => {
      const user = userEvent.setup();
      let posts = 0;
      listsAre([aList({ name: "Dom" })]);
      server.use(
        http.post("*/api/v1/lists", () => {
          posts += 1;
          return HttpResponse.json(aList(), { status: 201 });
        }),
      );
      renderApp("/listy");
      await user.click(await screen.findByRole("button", { name: "+ Nowa lista" }));
      const field = screen.getByRole("textbox", { name: "Nazwa listy" });

      await user.type(field, "   ");
      await user.click(screen.getByRole("button", { name: "Utwórz" }));
      expect(field).toHaveAccessibleDescription("Wpisz nazwę listy");
      expect(field).toHaveAttribute("aria-invalid", "true");

      await user.clear(field);
      await user.click(field);
      await user.paste("a".repeat(101));
      await user.keyboard("{Enter}");
      expect(field).toHaveAccessibleDescription(
        expect.stringContaining("Nazwa listy może mieć najwyżej 100 znaków"),
      );
      expect(posts).toBe(0);
    });

    it("says the list was not created when the request fails and keeps the name", async () => {
      const user = userEvent.setup();
      listsAre([aList({ name: "Dom" })]);
      server.use(http.post("*/api/v1/lists", () => apiError(500, { code: "internal" })));
      renderApp("/listy");
      await user.click(await screen.findByRole("button", { name: "+ Nowa lista" }));

      await user.type(screen.getByRole("textbox", { name: "Nazwa listy" }), "Zakupy{Enter}");

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Nie udało się utworzyć listy. Spróbuj ponownie.",
      );
      expect(screen.getByRole("textbox", { name: "Nazwa listy" })).toHaveValue("Zakupy");
    });

    it("shows the name error the API returns (AC2)", async () => {
      const user = userEvent.setup();
      listsAre([aList({ name: "Dom" })]);
      server.use(
        http.post("*/api/v1/lists", () =>
          apiError(400, { code: "validation_failed", fields: { name: "too_long" } }),
        ),
      );
      renderApp("/listy");
      await user.click(await screen.findByRole("button", { name: "+ Nowa lista" }));

      await user.type(screen.getByRole("textbox", { name: "Nazwa listy" }), "Zakupy{Enter}");

      expect(await screen.findByText("Nazwa listy może mieć najwyżej 100 znaków")).toBeVisible();
    });
  });

  describe("limit of 50 own lists (AC3)", () => {
    const LIMIT =
      "Masz już 50 list — to limit. Usuń listę, której nie używasz, żeby utworzyć nową.";

    it("warns and disables „+ Nowa lista” at 50 own lists", async () => {
      listsAre(Array.from({ length: 50 }, () => aList()));

      renderApp("/listy");

      expect(await screen.findByText(LIMIT)).toBeVisible();
      expect(screen.getByRole("button", { name: "+ Nowa lista" })).toBeDisabled();
    });

    it("does not count lists shared with the person", async () => {
      listsAre([
        ...Array.from({ length: 49 }, () => aList()),
        aList({ role: "participant", owner: TOMEK }),
      ]);

      renderApp("/listy");

      expect(await screen.findByRole("button", { name: "+ Nowa lista" })).toBeEnabled();
      expect(screen.queryByText(LIMIT)).toBeNull();
    });

    it("warns when the API refuses the list because of the limit", async () => {
      const user = userEvent.setup();
      listsAre([aList({ name: "Dom" })]);
      server.use(
        http.post("*/api/v1/lists", () => apiError(409, { code: "limit_reached", limit: "lists" })),
      );
      renderApp("/listy");
      await user.click(await screen.findByRole("button", { name: "+ Nowa lista" }));

      await user.type(screen.getByRole("textbox", { name: "Nazwa listy" }), "Zakupy{Enter}");

      expect(await screen.findByText(LIMIT)).toBeVisible();
      expect(screen.getByRole("button", { name: "+ Nowa lista" })).toBeDisabled();
    });
  });
});
