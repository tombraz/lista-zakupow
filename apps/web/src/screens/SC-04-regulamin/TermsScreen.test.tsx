import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { renderApp, sessionIs } from "../../../test/render";

describe("SC-04 Regulamin i polityka prywatności (AC8)", () => {
  beforeEach(() => {
    sessionIs(null);
  });

  it("shows a table of contents linking to both documents", async () => {
    renderApp("/regulamin");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Regulamin i polityka prywatności" }),
    ).toBeVisible();
    const toc = screen.getByRole("navigation", { name: "Spis treści" });
    expect(within(toc).getByRole("link", { name: "Regulamin" })).toHaveAttribute(
      "href",
      "#regulamin",
    );
    expect(within(toc).getByRole("link", { name: "Polityka prywatności" })).toHaveAttribute(
      "href",
      "#polityka-prywatnosci",
    );
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Regulamin",
      "Polityka prywatności",
    ]);
  });

  it("covers the points the privacy policy must describe", async () => {
    renderApp("/regulamin");
    await screen.findByRole("heading", { level: 1 });

    const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(
      expect.arrayContaining([
        "Jakie dane zbieramy",
        "Kto widzi Twoje dane",
        "Bez zewnętrznej analityki",
        "Usunięcie konta",
        "Kopie zapasowe",
      ]) as string[],
    );
    const privacy = screen.getByRole("region", { name: "Polityka prywatności" });
    for (const fact of ["imię", "adres e-mail", "treść list", "7 dni"]) {
      expect(privacy).toHaveTextContent(fact);
    }
  });

  it("moves focus to the section chosen in the table of contents", async () => {
    const user = userEvent.setup();
    renderApp("/regulamin");

    await user.click(await screen.findByRole("link", { name: "Polityka prywatności" }));

    expect(screen.getByRole("heading", { level: 2, name: "Polityka prywatności" })).toHaveFocus();
  });

  it("offers „Wróć” to SC-01 when opened directly", async () => {
    const user = userEvent.setup();
    const { router } = renderApp("/regulamin");

    await user.click(await screen.findByRole("link", { name: "Wróć" }));

    expect(router.state.location.pathname).toBe("/logowanie");
  });
});
