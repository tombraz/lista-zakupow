import type { ListSummary } from "@lista/shared";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { browserGoes, liveServer } from "../../../test/live";
import { aList, ANIA, apiError, listHandlers, TOMEK } from "../../../test/lists";
import { server } from "../../../test/msw-server";
import { renderApp, sessionIs } from "../../../test/render";

type Respond = () => Promise<Response | undefined>;

/**
 * SC-06 Tomka (uczestnik „Dom” Ani) z serwerem, który naprawdę wypisuje: po `POST …/leave`
 * lista znika z `GET /lists`, a szczegóły odpowiadają 404, jak w API (T-094).
 */
async function tomeksList(respond?: Respond) {
  sessionIs({ ...TOMEK, email: "tomek@example.com" });
  liveServer();
  const list: ListSummary = aList({
    name: "Dom",
    role: "participant",
    owner: { id: ANIA.id, name: ANIA.name },
    members: [TOMEK],
  });
  const other = aList({ name: "Działka", role: "participant" });
  let member = true;
  const leaves: string[] = [];
  const gone = () => apiError(404, { code: "not_found" });
  server.use(
    http.get("*/api/v1/lists", () => HttpResponse.json(member ? [list, other] : [other])),
    http.get(`*/api/v1/lists/${list.id}`, () => (member ? undefined : gone())),
    http.get(`*/api/v1/lists/${list.id}/members`, () => (member ? undefined : gone())),
    ...listHandlers(list),
    http.post(`*/api/v1/lists/${list.id}/leave`, async () => {
      leaves.push(list.id);
      const answer = await respond?.();
      if (answer) return answer;
      member = false;
      return new HttpResponse(null, { status: 204 });
    }),
  );
  // Jak w przeglądarce: SC-05 → SC-06.
  const view = renderApp("/listy");
  await screen.findByText("Dom");
  await act(() => view.router.navigate(`/listy/${list.id}`));
  await screen.findByRole("heading", { level: 1, name: "Dom" });
  return { ...view, list, leaves, user: userEvent.setup() };
}

function more() {
  return screen.getByRole("button", { name: "Więcej opcji" });
}

function dialog() {
  return within(screen.getByRole("alertdialog", { name: "Opuścić listę „Dom”?" }));
}

// AC1, AC2 (F-13, SC-06 Layout pkt 1): akcje AppBar dla każdej osoby z dostępem.
describe("SC-06 of a participant, the app bar", () => {
  it("links „Uczestnicy” to SC-07 of this list", async () => {
    const { list } = await tomeksList();

    expect(screen.getByRole("link", { name: "Uczestnicy" })).toHaveAttribute(
      "href",
      `/listy/${list.id}/uczestnicy`,
    );
  });

  it("offers only „Opuść listę” under „Więcej opcji” (SEC2)", async () => {
    const { user } = await tomeksList();

    await user.click(more());

    expect(more()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Opuść listę" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Zmień nazwę listy" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Usuń listę" })).toBeNull();
  });
});

// AC3: wyjście z SC-06 jak z SC-07 (T-059 AC3).
describe("SC-06 leaving a list", () => {
  it("asks first, then replaces SC-06 with SC-05 without the list", async () => {
    const { leaves, router, user } = await tomeksList();

    await user.click(more());
    await user.click(screen.getByRole("button", { name: "Opuść listę" }));
    expect(
      screen.getByRole("alertdialog", { name: "Opuścić listę „Dom”?" }),
    ).toHaveAccessibleDescription("Żeby wrócić, potrzebujesz nowego zaproszenia.");
    expect(dialog().getByRole("button", { name: "Anuluj" })).toHaveFocus();
    await user.click(dialog().getByRole("button", { name: "Opuść" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Moje listy" })).toBeVisible();
    expect(await screen.findByText("Działka")).toBeVisible();
    expect(screen.queryByText("Dom")).not.toBeInTheDocument();
    expect(leaves).toHaveLength(1);
    expect(router.state.location.pathname).toBe("/listy");
    expect(router.state.historyAction).toBe("REPLACE");
  });

  it("closes on „Anuluj” with focus back on „Więcej opcji”, leaving nothing", async () => {
    const { leaves, user } = await tomeksList();

    await user.click(more());
    await user.click(screen.getByRole("button", { name: "Opuść listę" }));
    await user.click(dialog().getByRole("button", { name: "Anuluj" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(more()).toHaveFocus();
    expect(leaves).toEqual([]);
  });

  it("keeps the dialog open with „Nie udało się opuścić listy. Spróbuj ponownie.” and lets the participant retry", async () => {
    let attempts = 0;
    const { leaves, user } = await tomeksList(() => {
      attempts += 1;
      return Promise.resolve(attempts === 1 ? apiError(500, { code: "internal" }) : undefined);
    });

    await user.click(more());
    await user.click(screen.getByRole("button", { name: "Opuść listę" }));
    await user.click(dialog().getByRole("button", { name: "Opuść" }));

    expect(
      await dialog().findByText("Nie udało się opuścić listy. Spróbuj ponownie."),
    ).toBeVisible();
    expect(screen.getByRole("heading", { level: 1, name: "Dom" })).toBeInTheDocument();
    await user.click(dialog().getByRole("button", { name: "Opuść" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Moje listy" })).toBeVisible();
    expect(leaves).toHaveLength(2);
  });

  it("says there is no connection when the request breaks, by the error code", async () => {
    const { user } = await tomeksList(() => Promise.resolve(HttpResponse.error()));

    await user.click(more());
    await user.click(screen.getByRole("button", { name: "Opuść listę" }));
    await user.click(dialog().getByRole("button", { name: "Opuść" }));

    expect(await dialog().findByText(/Brak połączenia/)).toBeVisible();
    expect(dialog().queryByText("Nie udało się opuścić listy. Spróbuj ponownie.")).toBeNull();
  });

  it("makes „Opuść listę” inactive without a connection and opens no dialog (T-063)", async () => {
    const { leaves, user } = await tomeksList();

    browserGoes("offline");
    await user.click(more());

    const leave = screen.getByRole("button", { name: "Opuść listę" });
    await waitFor(() => {
      expect(leave).toHaveAttribute("aria-disabled", "true");
    });
    expect(leave).toHaveAccessibleDescription(/Brak połączenia/);
    await user.click(leave);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(leaves).toEqual([]);
  });
});
