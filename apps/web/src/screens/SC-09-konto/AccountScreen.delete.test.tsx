import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { heldResponse, type HeldResponse } from "../../../test/held";
import { aList, ANIA, apiError, listsAre, TOMEK } from "../../../test/lists";
import { browserGoes, liveServer } from "../../../test/live";
import { server } from "../../../test/msw-server";
import { renderApp, sessionIs } from "../../../test/render";

type Answer = () => Response;

/** `DELETE /api/v1/me`: kolejne odpowiedzi z `answers` (ostatnia się powtarza); zapisuje treści. */
function deletion(
  answers: Answer[] = [() => new HttpResponse(null, { status: 204 })],
  held?: HeldResponse,
) {
  const sent: unknown[] = [];
  server.use(
    http.delete("*/api/v1/me", async ({ request }) => {
      sent.push(await request.json());
      await held?.released;
      const answer = answers[Math.min(sent.length, answers.length) - 1];
      return answer ? answer() : HttpResponse.error();
    }),
  );
  return sent;
}

async function openDialog() {
  const view = await openAccount();
  await view.user.click(view.trigger);
  const dialog = await screen.findByRole("alertdialog", { name: "Usunąć konto na zawsze?" });
  const confirm = within(dialog).getByRole("button", { name: "Usuń konto" });
  return { ...view, dialog, confirm };
}

/** Ania: właścicielka „Dom”, uczestniczka „Działka” Tomka. */
function aniasLists() {
  listsAre([
    aList({ name: "Dom" }),
    aList({ name: "Działka", role: "participant", owner: { id: TOMEK.id, name: TOMEK.name } }),
  ]);
}

async function openAccount() {
  const user = userEvent.setup();
  const view = renderApp("/konto");
  const trigger = await screen.findByRole("button", { name: "Usuń konto" });
  return { user, trigger, ...view };
}

// T-062 AC4 (F-04): usunięcie konta na SC-09.
describe("SC-09 Konto: deleting the account", () => {
  beforeEach(() => {
    sessionIs(ANIA);
    aniasLists();
  });

  it("shows the „Usuń konto” section with its consequences", async () => {
    await openAccount();

    const section = screen.getByRole("region", { name: "Usuń konto" });
    expect(within(section).getByRole("heading", { level: 2, name: "Usuń konto" })).toBeVisible();
    expect(
      within(section).getByText(
        "Usunięcie konta jest trwałe. Twoje listy zostaną usunięte także u uczestników. Z cudzych list zostaniesz wypisany(-a), a dodane przez Ciebie pozycje zostaną z podpisem „usunięty użytkownik”.",
      ),
    ).toBeVisible();
  });

  it("asks in a ConfirmDialog with the number of own lists and focus on „Anuluj”", async () => {
    const { user, trigger } = await openAccount();

    await user.click(trigger);

    const dialog = await screen.findByRole("alertdialog", { name: "Usunąć konto na zawsze?" });
    expect(dialog).toHaveAccessibleDescription(
      "1 Twoich list zniknie, także u ich uczestników. Tego nie da się cofnąć.",
    );
    expect(within(dialog).getByRole("button", { name: "Anuluj" })).toHaveFocus();
    await user.click(within(dialog).getByRole("button", { name: "Anuluj" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("deletes once, keeps the dialog open while saving, then shows SC-01 with „Konto zostało usunięte.”", async () => {
    const held = heldResponse();
    const sent = deletion(undefined, held);
    const { user, router, dialog, confirm } = await openDialog();

    act(() => {
      fireEvent.click(confirm);
      fireEvent.click(confirm);
    });
    await waitFor(() => {
      expect(confirm).toHaveAttribute("aria-disabled", "true");
    });
    await user.keyboard("{Escape}");
    await user.click(within(dialog).getByRole("button", { name: "Anuluj" }));
    expect(screen.getByRole("alertdialog")).toBeVisible();
    held.release();

    expect(await screen.findByRole("status")).toHaveTextContent("Konto zostało usunięte.");
    expect(router.state.location.pathname).toBe("/logowanie");
    expect(router.state.historyAction).toBe("REPLACE");
    expect(sent).toEqual([{ confirm: true }]);
    // Sesja klienta wyczyszczona: „Moje listy” prowadzą na SC-01, bez pytania API o sesję.
    await act(() => router.navigate("/listy"));
    expect(router.state.location.pathname).toBe("/logowanie");
  });

  it("shows „Nie udało się zapisać. Spróbuj ponownie.” in the dialog when the server fails", async () => {
    deletion([() => apiError(500, { code: "internal" })]);
    const { user, router, dialog, confirm } = await openDialog();

    await user.click(confirm);

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Nie udało się zapisać. Spróbuj ponownie.",
    );
    expect(router.state.location.pathname).toBe("/konto");
    expect(confirm).not.toHaveAttribute("aria-disabled");
  });

  // Client state during writes: odpowiedź utracona po usunięciu; ponowienie dostaje 401.
  it("goes to SC-01 with „Konto zostało usunięte.” when the retry of a lost response gets 401", async () => {
    const sent = deletion([
      () => HttpResponse.error(),
      () => apiError(401, { code: "unauthenticated" }),
    ]);
    const { user, router, dialog, confirm } = await openDialog();
    await user.click(confirm);
    await within(dialog).findByRole("alert");

    await user.click(confirm);

    expect(await screen.findByText("Konto zostało usunięte.")).toBeVisible();
    expect(router.state.location.pathname).toBe("/logowanie");
    expect(screen.queryByText(/Nie udało się/)).toBeNull();
    expect(sent).toHaveLength(2);
  });

  // 401 przy pierwszej próbie: sesja skończyła się wcześniej, konto nie zostało usunięte.
  it("ends the session without the deletion message when the first attempt gets 401", async () => {
    deletion([() => apiError(401, { code: "unauthenticated" })]);
    const { user, router, confirm } = await openDialog();

    await user.click(confirm);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/logowanie");
    });
    expect(screen.queryByText("Konto zostało usunięte.")).toBeNull();
  });

  it("makes „Usuń konto” inactive offline", async () => {
    const sent = deletion();
    const { user, trigger } = await openAccount();

    browserGoes("offline");
    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(sent).toEqual([]);
    browserGoes("online");
  });

  it("makes „Usuń konto” in the dialog inactive when the connection drops while it is open", async () => {
    const sent = deletion();
    const { user, confirm } = await openDialog();

    browserGoes("offline");
    await user.click(confirm);

    expect(confirm).toHaveAttribute("aria-disabled", "true");
    expect(sent).toEqual([]);
    browserGoes("online");
  });

  // Client state during writes: liczba list zmienia się przy otwartym oknie (`lists.changed`).
  it("updates the number of own lists in the open dialog after lists.changed", async () => {
    const live = liveServer();
    const { dialog } = await openDialog();
    expect(dialog).toHaveAccessibleDescription(/^1 Twoich list/);

    listsAre([aList({ name: "Dom" }), aList({ name: "Garaż" })]);
    act(() => {
      live.send({ type: "lists.changed" });
    });

    await waitFor(() => {
      expect(dialog).toHaveAccessibleDescription(
        "2 Twoich list zniknie, także u ich uczestników. Tego nie da się cofnąć.",
      );
    });
  });

  it("describes the consequences without a number when the lists did not load", async () => {
    server.use(http.get("*/api/v1/lists", () => apiError(500, { code: "internal" })));
    const { dialog } = await openDialog();

    expect(dialog).toHaveAccessibleDescription(
      "Usunięcie konta jest trwałe. Twoje listy zostaną usunięte także u uczestników. Z cudzych list zostaniesz wypisany(-a), a dodane przez Ciebie pozycje zostaną z podpisem „usunięty użytkownik”.",
    );
  });
});
