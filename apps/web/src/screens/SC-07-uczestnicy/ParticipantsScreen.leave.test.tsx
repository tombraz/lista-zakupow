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

type Respond = (leaveOnServer: () => void) => Promise<Response | undefined>;

/**
 * SC-07 Tomka (uczestnik „Dom” Ani) z serwerem, który naprawdę wypisuje: po `POST …/leave`
 * lista znika z `GET /lists`, a szczegóły i uczestnicy odpowiadają 404, jak w API.
 * `respond` może podmienić odpowiedź (opóźnić, zerwać, odmówić).
 */
async function tomeksParticipants(respond?: Respond) {
  sessionIs({ ...TOMEK, email: "tomek@example.com" });
  const live = liveServer();
  const list: ListSummary = aList({
    name: "Dom",
    role: "participant",
    owner: { id: ANIA.id, name: ANIA.name },
    members: [TOMEK, OLA],
  });
  const other = aList({ name: "Działka", role: "participant" });
  let member = true;
  const leaves: string[] = [];
  const leaveOnServer = () => {
    member = false;
  };
  const gone = () => apiError(404, { code: "not_found" });
  server.use(
    http.get("*/api/v1/lists", () => HttpResponse.json(member ? [list, other] : [other])),
    http.get(`*/api/v1/lists/${list.id}`, () => (member ? undefined : gone())),
    http.get(`*/api/v1/lists/${list.id}/members`, () => (member ? undefined : gone())),
    ...listHandlers(list),
    http.post(`*/api/v1/lists/${list.id}/leave`, async () => {
      leaves.push(list.id);
      const answer = await respond?.(leaveOnServer);
      if (answer) return answer;
      if (!member) return gone();
      leaveOnServer();
      return new HttpResponse(null, { status: 204 });
    }),
  );
  // Jak w przeglądarce: SC-05 → SC-06 → SC-07, więc SC-05 ma już listy w cache.
  const view = renderApp("/listy");
  await screen.findByText("Dom");
  await act(() => view.router.navigate(`/listy/${list.id}`));
  await act(() => view.router.navigate(`/listy/${list.id}/uczestnicy`));
  await screen.findByRole("region", { name: "Na liście (2 z 20)" });
  return { ...view, list, other, live, leaves, user: userEvent.setup() };
}

function leaveButton() {
  return screen.getByRole("button", { name: "Opuść listę" });
}

function dialog() {
  return within(screen.getByRole("alertdialog", { name: "Opuścić listę „Dom”?" }));
}

// AC3 (F-13): uczestnik opuszcza listę z SC-07.
describe("SC-07 leaving a list", () => {
  it("asks first, then replaces SC-07 with SC-05 without the list", async () => {
    const { leaves, router, user } = await tomeksParticipants();

    await user.click(leaveButton());
    expect(
      screen.getByRole("alertdialog", { name: "Opuścić listę „Dom”?" }),
    ).toHaveAccessibleDescription("Żeby wrócić, potrzebujesz nowego zaproszenia.");
    expect(dialog().getByRole("button", { name: "Anuluj" })).toHaveFocus();
    await user.click(dialog().getByRole("button", { name: "Opuść" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Moje listy" })).toBeVisible();
    expect(await screen.findByText("Działka")).toBeVisible();
    expect(screen.queryByText("Dom")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(leaves).toHaveLength(1);
    expect(router.state.location.pathname).toBe("/listy");
    expect(router.state.historyAction).toBe("REPLACE");
    await waitFor(() => {
      expect(screen.queryByText(/nie masz już do niej dostępu/)).not.toBeInTheDocument();
    });
  });
});

describe("SC-07 leaving a list, the dialog", () => {
  it("closes on „Anuluj” and on Escape with focus back on „Opuść listę”, leaving nothing", async () => {
    const { leaves, user } = await tomeksParticipants();

    await user.click(leaveButton());
    await user.click(dialog().getByRole("button", { name: "Anuluj" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(leaveButton()).toHaveFocus();

    await user.click(leaveButton());
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(leaveButton()).toHaveFocus();
    expect(leaves).toEqual([]);
    expect(screen.getByRole("region", { name: "Na liście (2 z 20)" })).toBeVisible();
  });

  it("keeps the dialog open with „Nie udało się opuścić listy. Spróbuj ponownie.” and lets the participant retry", async () => {
    let attempts = 0;
    const { leaves, user } = await tomeksParticipants(() => {
      attempts += 1;
      return Promise.resolve(attempts === 1 ? apiError(500, { code: "internal" }) : undefined);
    });

    await user.click(leaveButton());
    await user.click(dialog().getByRole("button", { name: "Opuść" }));

    expect(
      await dialog().findByText("Nie udało się opuścić listy. Spróbuj ponownie."),
    ).toBeVisible();
    expect(screen.getByRole("heading", { level: 1, name: "Uczestnicy" })).toBeInTheDocument();
    await user.click(dialog().getByRole("button", { name: "Opuść" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Moje listy" })).toBeVisible();
    expect(leaves).toHaveLength(2);
  });

  it("makes „Opuść listę” inactive without a connection and opens no dialog (T-063)", async () => {
    const { leaves, user } = await tomeksParticipants();

    browserGoes("offline");

    const leave = leaveButton();
    await waitFor(() => {
      expect(leave).toHaveAttribute("aria-disabled", "true");
    });
    await user.click(leave);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(leaves).toEqual([]);
  });
});

// AC2: właściciel nie może opuścić własnej listy.
describe("SC-07 of the owner", () => {
  it("has no „Opuść listę”", async () => {
    sessionIs(ANIA);
    liveServer();
    const list = aList({ name: "Dom", members: [TOMEK] });
    server.use(
      ...listHandlers(list),
      http.get(`*/api/v1/lists/${list.id}/invitations`, () => HttpResponse.json([])),
    );
    renderApp(`/listy/${list.id}/uczestnicy`);

    expect(await screen.findByRole("region", { name: "Zaproszenia" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Opuść listę" })).not.toBeInTheDocument();
  });
});

// TDD plan, „Client state during writes”.
describe("SC-07 leaving a list while things change", () => {
  it("sends one request for a double „Opuść” during a slow response (T-020)", async () => {
    const held = heldResponse();
    const { leaves, user } = await tomeksParticipants(async () => {
      await held.released;
      return undefined;
    });

    await user.click(leaveButton());
    const confirm = dialog().getByRole("button", { name: "Opuść" });
    act(() => {
      fireEvent.click(confirm);
      fireEvent.click(confirm);
    });
    await waitFor(() => {
      expect(leaves).toHaveLength(1);
    });
    expect(confirm).toHaveAttribute("aria-disabled", "true");
    held.release();

    expect(await screen.findByRole("heading", { level: 1, name: "Moje listy" })).toBeVisible();
    expect(leaves).toHaveLength(1);
  });

  it("lands on SC-05 without an error when the retry after a lost response gets 404", async () => {
    let attempts = 0;
    const { leaves, user } = await tomeksParticipants((leaveOnServer) => {
      attempts += 1;
      if (attempts > 1) return Promise.resolve(undefined);
      leaveOnServer();
      return Promise.resolve(HttpResponse.error());
    });

    await user.click(leaveButton());
    await user.click(dialog().getByRole("button", { name: "Opuść" }));
    await dialog().findByText("Brak połączenia. Sprawdź internet i spróbuj ponownie.");
    await user.click(dialog().getByRole("button", { name: "Opuść" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Moje listy" })).toBeVisible();
    expect(await screen.findByText("Działka")).toBeVisible();
    expect(screen.queryByText("Dom")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(leaves).toHaveLength(2);
  });

  it("goes to SC-05 once, without the „no access” notice, when access.revoked comes before the response", async () => {
    const held = heldResponse();
    const { list, live, router, user } = await tomeksParticipants(async (leaveOnServer) => {
      leaveOnServer();
      await held.released;
      return undefined;
    });
    const visited: string[] = [];
    router.subscribe((state) => {
      visited.push(state.location.pathname);
    });

    await user.click(leaveButton());
    await user.click(dialog().getByRole("button", { name: "Opuść" }));
    act(() => {
      live.send({ type: "access.revoked", listId: list.id });
    });
    await waitFor(() => {
      expect(dialog().getByRole("button", { name: "Opuść" })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
    });
    expect(router.state.location.pathname).toBe(`/listy/${list.id}/uczestnicy`);
    held.release();

    expect(await screen.findByRole("heading", { level: 1, name: "Moje listy" })).toBeVisible();
    expect(screen.queryByText(/nie masz już do niej dostępu/)).not.toBeInTheDocument();
    expect(visited).toEqual(["/listy"]);
  });

  it("shows SC-05 without the list at once, before the lists are fetched again", async () => {
    const { other, user } = await tomeksParticipants();
    const held = heldResponse();
    server.use(
      http.get("*/api/v1/lists", async () => {
        await held.released;
        return HttpResponse.json([other]);
      }),
    );

    await user.click(leaveButton());
    await user.click(dialog().getByRole("button", { name: "Opuść" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Moje listy" })).toBeVisible();
    expect(screen.getByText("Działka")).toBeVisible();
    expect(screen.queryByText("Dom")).not.toBeInTheDocument();
    held.release();
  });

  it("does not bring the list back with „Wstecz” of the browser after leaving", async () => {
    const { list, router, user } = await tomeksParticipants();

    await user.click(leaveButton());
    await user.click(dialog().getByRole("button", { name: "Opuść" }));
    await screen.findByRole("heading", { level: 1, name: "Moje listy" });
    await act(() => router.navigate(-1));

    expect(router.state.location.pathname).toBe(`/listy/${list.id}`);
    expect(await screen.findByText("Wróć do moich list")).toBeVisible();
    expect(screen.queryByRole("heading", { level: 1, name: "Dom" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: "Uczestnicy" })).not.toBeInTheDocument();
  });
});
