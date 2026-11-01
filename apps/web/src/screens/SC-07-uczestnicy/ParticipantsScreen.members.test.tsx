import type { ListSummary, Me } from "@lista/shared";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { heldResponse } from "../../../test/held";
import { aList, ANIA, apiError, detailsOf, listHandlers, TOMEK } from "../../../test/lists";
import { server } from "../../../test/msw-server";
import { renderApp, sessionIs } from "../../../test/render";

const OLA = { id: "u-ola", name: "Ola" };
const TOMEK_ME: Me = { ...TOMEK, email: "tomek@example.com" };

/** SC-07 listy z odpowiedziami API jak z serwera (szczegóły, uczestnicy, linki właściciela). */
async function showParticipants(list: ListSummary) {
  server.use(
    ...listHandlers(list),
    http.get(`*/api/v1/lists/${list.id}/invitations`, () => HttpResponse.json([])),
  );
  renderApp(`/listy/${list.id}/uczestnicy`);
  await screen.findByRole("heading", { level: 1, name: "Uczestnicy" });
}

/** Wiersze sekcji „Na liście” jako tekst (imię + rola / e-mail). */
async function memberRows(heading: string) {
  const section = within(await screen.findByRole("region", { name: heading }));
  return section.getAllByRole("listitem").map((row) => row.textContent);
}

// AC2 (F-13): kto ma dostęp do listy; e-maile tylko w widoku właściciela.
describe("SC-07 Na liście", () => {
  it("shows the owner every participant with their e-mail and the count", async () => {
    sessionIs(ANIA);
    await showParticipants(aList({ name: "Dom", members: [TOMEK, OLA] }));

    expect(await memberRows("Na liście (2 z 20)")).toEqual([
      "AAniawłaściciel · Ty",
      "TTomektomek@example.com",
      "OOlaola@example.com",
    ]);
    expect(screen.getByRole("heading", { level: 2, name: "Na liście (2 z 20)" })).toBeVisible();
  });

  it("shows a participant „Ty” in their row, nobody's e-mail and no invitations", async () => {
    sessionIs(TOMEK_ME);
    await showParticipants(
      aList({ name: "Dom", role: "participant", owner: ANIA, members: [TOMEK, OLA] }),
    );

    expect(await memberRows("Na liście (2 z 20)")).toEqual(["AAniawłaściciel", "TTomekTy", "OOla"]);
    expect(screen.queryByText(/@example\.com/)).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Zaproszenia" })).not.toBeInTheDocument();
  });
});

// AC3 (SC-07 „Empty”, „Loading”, „Error — wczytanie”).
describe("SC-07 Na liście states", () => {
  it("shows only the owner row and the empty state when nobody joined", async () => {
    sessionIs(ANIA);
    await showParticipants(aList({ name: "Dom" }));

    expect(await memberRows("Na liście (0 z 20)")).toEqual(["AAniawłaściciel · Ty"]);
    expect(
      screen.getByText("Nikt jeszcze nie dołączył. Utwórz link i wyślij go domownikowi."),
    ).toBeVisible();
  });

  it("shows a skeleton of 3 rows until the participants load", async () => {
    sessionIs(ANIA);
    const list = aList({ name: "Dom", members: [TOMEK] });
    const held = heldResponse();
    server.use(
      http.get(`*/api/v1/lists/${list.id}`, () => HttpResponse.json(detailsOf(list))),
      http.get(`*/api/v1/lists/${list.id}/members`, async () => {
        await held.released;
        return HttpResponse.json({ owner: list.owner, participants: [] });
      }),
      http.get(`*/api/v1/lists/${list.id}/invitations`, () => HttpResponse.json([])),
    );
    renderApp(`/listy/${list.id}/uczestnicy`);
    await screen.findByRole("heading", { level: 1, name: "Uczestnicy" });

    const main = screen.getByRole("main");
    await waitFor(() => {
      expect(main.querySelectorAll("[data-skeleton]")).toHaveLength(3);
    });
    expect(main).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("region", { name: /Na liście/ })).not.toBeInTheDocument();
    held.release();
    expect(await screen.findByRole("region", { name: "Na liście (0 z 20)" })).toBeVisible();
  });

  it("says the participants did not load and retries with focus kept on the button", async () => {
    sessionIs(ANIA);
    const user = userEvent.setup();
    const list = aList({ name: "Dom", members: [TOMEK] });
    const held = heldResponse();
    let attempts = 0;
    server.use(
      http.get(`*/api/v1/lists/${list.id}`, () => HttpResponse.json(detailsOf(list))),
      http.get(`*/api/v1/lists/${list.id}/members`, async () => {
        attempts += 1;
        if (attempts === 1) return apiError(500, { code: "internal" });
        await held.released;
        return HttpResponse.json({ owner: list.owner, participants: [TOMEK] });
      }),
      http.get(`*/api/v1/lists/${list.id}/invitations`, () => HttpResponse.json([])),
    );
    renderApp(`/listy/${list.id}/uczestnicy`);

    expect(await screen.findByText("Nie udało się wczytać uczestników.")).toBeVisible();
    const retry = screen.getByRole("button", { name: "Spróbuj ponownie" });
    await user.click(retry);

    await waitFor(() => {
      expect(attempts).toBe(2);
    });
    expect(retry).toHaveFocus();
    held.release();
    expect(await screen.findByRole("region", { name: "Na liście (1 z 20)" })).toBeVisible();
  });
});
