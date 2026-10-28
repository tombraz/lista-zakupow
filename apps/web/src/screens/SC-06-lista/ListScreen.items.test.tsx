import type { Item } from "@lista/shared";
import { screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { aList, anItem, ANIA, detailsOf, TOMEK } from "../../../test/lists";
import { server } from "../../../test/msw-server";
import { renderApp, sessionIs } from "../../../test/render";

async function showList(items: Item[]) {
  const list = aList({ name: "Dom", members: [TOMEK] });
  server.use(
    http.get(`*/api/v1/lists/${list.id}`, () => HttpResponse.json(detailsOf(list, items))),
  );
  renderApp(`/listy/${list.id}`);
  await screen.findByRole("heading", { level: 1, name: "Dom" });
  return within(screen.getByRole("list", { name: "Do kupienia" }));
}

// AC8 (F-10): kto dodał pozycję; usunięty autor.
describe("SC-06 ItemRow", () => {
  beforeEach(() => {
    sessionIs(ANIA);
  });

  it("signs an item with the name of the person who added it", async () => {
    const rows = await showList([anItem({ name: "Chleb", addedBy: TOMEK })]);

    expect(rows.getByText("dodał(a) Tomek")).toBeVisible();
  });

  it("puts the note before the signature", async () => {
    const rows = await showList([anItem({ name: "Mleko", note: "2 l" })]);

    expect(rows.getByText("2 l · dodał(a) Ania")).toBeVisible();
  });

  it("signs an item of a deleted account with „usunięty użytkownik” (AC8)", async () => {
    const rows = await showList([anItem({ name: "Ser", addedBy: null })]);

    expect(rows.getByText("dodał(a) usunięty użytkownik")).toBeVisible();
  });

  it("shows a name with HTML as text (TH-15)", async () => {
    const rows = await showList([anItem({ name: '<img src=x onerror="alert(1)">' })]);

    expect(
      rows.getByRole("button", { name: 'Edytuj <img src=x onerror="alert(1)">' }),
    ).toBeVisible();
    expect(document.querySelector("img")).toBeNull();
  });
});
