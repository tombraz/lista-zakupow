import type { ListSummary } from "@lista/shared";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { heldResponse } from "../../../test/held";
import { browserGoes, liveServer } from "../../../test/live";
import { aList, ANIA, apiError, listHandlers, TOMEK } from "../../../test/lists";
import { server } from "../../../test/msw-server";
import { renderApp, sessionIs } from "../../../test/render";

const OLA = { id: "u-ola", name: "Ola" };

type Respond = (userId: string, removeOnServer: () => void) => Promise<Response | undefined>;

/**
 * SC-07 właściciela z serwerem, który naprawdę usuwa: `DELETE …/members/:userId` zmienia listę,
 * z której odpowiadają szczegóły i uczestnicy; osoba spoza listy = 404, jak w API.
 * `respond` może podmienić odpowiedź (opóźnić, zerwać, odmówić).
 */
async function ownersParticipants(
  members: ListSummary["members"],
  respond?: Respond,
  { strict = false } = {},
) {
  sessionIs(ANIA);
  const live = liveServer();
  let list = aList({ name: "Dom", members });
  const removals: string[] = [];
  const isMember = (userId: string) => list.members.some(({ id }) => id === userId);
  const removeOnServer = (userId: string) => {
    list = { ...list, members: list.members.filter(({ id }) => id !== userId) };
  };
  server.use(
    ...listHandlers(() => list),
    http.get(`*/api/v1/lists/${list.id}/invitations`, () => HttpResponse.json([])),
    http.delete(`*/api/v1/lists/${list.id}/members/:userId`, async ({ params }) => {
      const userId = String(params["userId"]);
      removals.push(userId);
      const answer = await respond?.(userId, () => {
        removeOnServer(userId);
      });
      if (answer) return answer;
      if (!isMember(userId)) return apiError(404, { code: "not_found" });
      removeOnServer(userId);
      return new HttpResponse(null, { status: 204 });
    }),
  );
  renderApp(`/listy/${list.id}/uczestnicy`, { strict });
  await screen.findByRole("region", { name: `Na liście (${String(members.length)} z 20)` });
  return { list, live, removals, removeOnServer, user: userEvent.setup() };
}

function rows() {
  const section = within(screen.getByRole("region", { name: /^Na liście/ }));
  return section.getAllByRole("listitem").map((row) => row.textContent);
}

function removeButton(name: string) {
  return screen.getByRole("button", { name: `Usuń ${name} z listy` });
}

function dialog(name: string) {
  return within(screen.getByRole("alertdialog", { name: `Usunąć ${name} z listy?` }));
}

// AC2 (F-13): usunięcie uczestnika z SC-07.
describe("SC-07 removing a participant", () => {
  it("asks first, then removes the row, moves focus to the next row and announces the count", async () => {
    const { removals, user } = await ownersParticipants([TOMEK, OLA]);

    await user.click(removeButton("Tomek"));
    const question = screen.getByRole("alertdialog", { name: "Usunąć Tomek z listy?" });
    expect(question).toHaveAccessibleDescription(
      "Straci do niej dostęp od razu. Dodane przez niego pozycje zostaną.",
    );
    expect(dialog("Tomek").getByRole("button", { name: "Anuluj" })).toHaveFocus();
    await user.click(dialog("Tomek").getByRole("button", { name: "Usuń" }));

    expect(
      await screen.findByRole("heading", { level: 2, name: "Na liście (1 z 20)" }),
    ).toBeVisible();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(rows()).toEqual(["AAniawłaściciel · Ty", "OOlaola@example.comUsuń"]);
    expect(removals).toEqual([TOMEK.id]);
    await waitFor(() => {
      expect(removeButton("Ola")).toHaveFocus();
    });
    expect(
      screen.getByText("Na liście (1 z 20)", { selector: "[role=status]" }),
    ).toBeInTheDocument();
  });

  it("moves focus to the „Na liście” heading after removing the last row", async () => {
    const { user } = await ownersParticipants([TOMEK, OLA]);

    await user.click(removeButton("Ola"));
    await user.click(dialog("Ola").getByRole("button", { name: "Usuń" }));

    const heading = await screen.findByRole("heading", { level: 2, name: "Na liście (1 z 20)" });
    await waitFor(() => {
      expect(heading).toHaveFocus();
    });
  });

  it("closes on „Anuluj” and on Escape with focus back on „Usuń”, removing nobody", async () => {
    const { removals, user } = await ownersParticipants([TOMEK, OLA]);

    await user.click(removeButton("Tomek"));
    await user.click(dialog("Tomek").getByRole("button", { name: "Anuluj" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(removeButton("Tomek")).toHaveFocus();

    await user.click(removeButton("Ola"));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(removeButton("Ola")).toHaveFocus();
    expect(removals).toEqual([]);
    expect(screen.getByRole("region", { name: "Na liście (2 z 20)" })).toBeVisible();
  });

  it("sends one request for a double „Usuń” in the dialog (T-020)", async () => {
    const held = heldResponse();
    const { removals, user } = await ownersParticipants([TOMEK], async () => {
      await held.released;
      return undefined;
    });

    await user.click(removeButton("Tomek"));
    const confirm = dialog("Tomek").getByRole("button", { name: "Usuń" });
    act(() => {
      fireEvent.click(confirm);
      fireEvent.click(confirm);
    });
    await waitFor(() => {
      expect(removals).toHaveLength(1);
    });
    expect(confirm).toHaveAttribute("aria-disabled", "true");
    held.release();

    expect(await screen.findByRole("region", { name: "Na liście (0 z 20)" })).toBeVisible();
    expect(removals).toEqual([TOMEK.id]);
  });
});

// AC4: błąd serwera i brak połączenia.
describe("SC-07 removing a participant fails", () => {
  it("keeps the dialog open with „Nie udało się usunąć. Spróbuj ponownie.” and lets the owner retry", async () => {
    let attempts = 0;
    const { removals, user } = await ownersParticipants([TOMEK, OLA], () => {
      attempts += 1;
      return Promise.resolve(attempts === 1 ? apiError(500, { code: "internal" }) : undefined);
    });

    await user.click(removeButton("Tomek"));
    await user.click(dialog("Tomek").getByRole("button", { name: "Usuń" }));

    expect(
      await dialog("Tomek").findByText("Nie udało się usunąć. Spróbuj ponownie."),
    ).toBeVisible();
    expect(rows()).toHaveLength(3);
    await user.click(dialog("Tomek").getByRole("button", { name: "Usuń" }));

    expect(await screen.findByRole("region", { name: "Na liście (1 z 20)" })).toBeVisible();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(removals).toEqual([TOMEK.id, TOMEK.id]);
  });

  // T-079: tekst według kodu błędu, przez wspólne `errorText`.
  it("shows the connection text when the request fails on the network", async () => {
    const { user } = await ownersParticipants([TOMEK, OLA], () =>
      Promise.resolve(HttpResponse.error()),
    );

    await user.click(removeButton("Tomek"));
    await user.click(dialog("Tomek").getByRole("button", { name: "Usuń" }));

    expect(
      await dialog("Tomek").findByText("Brak połączenia. Sprawdź internet i spróbuj ponownie."),
    ).toBeVisible();
    expect(screen.queryByText("Nie udało się usunąć. Spróbuj ponownie.")).not.toBeInTheDocument();
    expect(rows()).toHaveLength(3);
  });

  it("makes „Usuń” inactive without a connection and opens no dialog (T-015, T-063)", async () => {
    const { removals, user } = await ownersParticipants([TOMEK]);

    browserGoes("offline");

    const remove = removeButton("Tomek");
    await waitFor(() => {
      expect(remove).toHaveAttribute("aria-disabled", "true");
    });
    await user.click(remove);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(removals).toEqual([]);
  });
});

// TDD plan, „Client state during writes”.
describe("SC-07 removing a participant while things change", () => {
  it("removes both rows when the owner removes a second person during a slow first removal", async () => {
    const held = heldResponse();
    const { user } = await ownersParticipants([TOMEK, OLA], async (userId) => {
      if (userId === TOMEK.id) await held.released;
      return undefined;
    });

    await user.click(removeButton("Tomek"));
    await user.click(dialog("Tomek").getByRole("button", { name: "Usuń" }));
    await user.click(dialog("Tomek").getByRole("button", { name: "Anuluj" }));
    expect(removeButton("Tomek")).toHaveAttribute("aria-disabled", "true");
    await user.click(removeButton("Ola"));
    await user.click(dialog("Ola").getByRole("button", { name: "Usuń" }));

    expect(await screen.findByRole("region", { name: "Na liście (1 z 20)" })).toBeVisible();
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 2, name: "Na liście (1 z 20)" })).toHaveFocus();
    });
    held.release();

    const heading = await screen.findByRole("heading", { level: 2, name: "Na liście (0 z 20)" });
    expect(rows()).toEqual(["AAniawłaściciel · Ty"]);
    expect(document.activeElement).not.toBe(document.body);
    expect(heading).toHaveFocus();
  });

  it("removes the row without an error when the retry after a lost response gets 404", async () => {
    let attempts = 0;
    const { removals, user } = await ownersParticipants([TOMEK, OLA], (_, removeOnServer) => {
      attempts += 1;
      if (attempts > 1) return Promise.resolve(undefined);
      removeOnServer();
      return Promise.resolve(HttpResponse.error());
    });

    await user.click(removeButton("Tomek"));
    await user.click(dialog("Tomek").getByRole("button", { name: "Usuń" }));
    await dialog("Tomek").findByText("Brak połączenia. Sprawdź internet i spróbuj ponownie.");
    await user.click(dialog("Tomek").getByRole("button", { name: "Usuń" }));

    expect(await screen.findByRole("region", { name: "Na liście (1 z 20)" })).toBeVisible();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Brak połączenia. Sprawdź internet i spróbuj ponownie."),
    ).not.toBeInTheDocument();
    expect(removals).toEqual([TOMEK.id, TOMEK.id]);
    await waitFor(() => {
      expect(removeButton("Ola")).toHaveFocus();
    });
  });

  it("closes the dialog without an error when that participant left meanwhile (members.changed)", async () => {
    const { list, live, removeOnServer, user } = await ownersParticipants([TOMEK, OLA]);

    await user.click(removeButton("Tomek"));
    removeOnServer(TOMEK.id);
    act(() => {
      live.send({ type: "members.changed", listId: list.id });
    });

    expect(await screen.findByRole("region", { name: "Na liście (1 z 20)" })).toBeVisible();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(removeButton("Ola")).toHaveFocus();
    });
  });

  // T-097: zamknięcie okna i fokus w efekcie; podwójny render StrictMode nie gubi następnego wiersza.
  it("moves focus to the next row in StrictMode when that participant left meanwhile", async () => {
    const { list, live, removeOnServer, user } = await ownersParticipants([TOMEK, OLA], undefined, {
      strict: true,
    });

    await user.click(removeButton("Tomek"));
    removeOnServer(TOMEK.id);
    act(() => {
      live.send({ type: "members.changed", listId: list.id });
    });

    expect(await screen.findByRole("region", { name: "Na liście (1 z 20)" })).toBeVisible();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(removeButton("Ola")).toHaveFocus();
    });
  });

  it("moves focus to the „Na liście” heading in StrictMode when the last participant left meanwhile", async () => {
    const { list, live, removeOnServer, user } = await ownersParticipants([TOMEK, OLA], undefined, {
      strict: true,
    });

    await user.click(removeButton("Ola"));
    removeOnServer(OLA.id);
    act(() => {
      live.send({ type: "members.changed", listId: list.id });
    });

    const heading = await screen.findByRole("heading", { level: 2, name: "Na liście (1 z 20)" });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(heading).toHaveFocus();
    });
  });

  it("keeps another participant's dialog open in StrictMode when someone else left", async () => {
    const { list, live, removeOnServer, user } = await ownersParticipants([TOMEK, OLA], undefined, {
      strict: true,
    });

    await user.click(removeButton("Ola"));
    removeOnServer(TOMEK.id);
    act(() => {
      live.send({ type: "members.changed", listId: list.id });
    });

    expect(await screen.findByRole("region", { name: "Na liście (1 z 20)" })).toBeVisible();
    expect(dialog("Ola").getByRole("button", { name: "Anuluj" })).toHaveFocus();
  });
});
