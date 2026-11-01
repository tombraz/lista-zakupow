import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aList, anItem, ANIA, detailsOf, listHandlers, listsAre } from "../../test/lists";
import { browserGoes, liveServer } from "../../test/live";
import { server } from "../../test/msw-server";
import { renderApp, sessionIs } from "../../test/render";

const OFFLINE = "Brak połączenia. Zmiany nie są zapisywane.";

/** Każde żądanie zapisu (nie GET) do API. */
function writesSent() {
  const writes: string[] = [];
  server.events.on("request:start", ({ request }) => {
    if (request.method !== "GET") writes.push(`${request.method} ${new URL(request.url).pathname}`);
  });
  return writes;
}

/** Przycisk zapisu offline (pasek już widoczny): jak `expectInactiveOffline`. */
async function expectInactive(button: HTMLElement, writes: string[]) {
  const user = userEvent.setup();
  act(() => {
    button.focus();
  });
  expect(button).toHaveAttribute("aria-disabled", "true");
  expect(button).toHaveAccessibleDescription(OFFLINE);
  await user.click(button);
  expect(button).toHaveFocus();
  expect(writes).toEqual([]);
}

/**
 * Przycisk zapisu offline: `aria-disabled` z wyjaśnieniem (pasek), fokus zostaje na nim,
 * kliknięcie nic nie wysyła (AC2).
 */
async function expectInactiveOffline(button: HTMLElement, writes: string[]) {
  const user = userEvent.setup();
  act(() => {
    button.focus();
  });
  browserGoes("offline");
  await screen.findByText(OFFLINE);
  expect(button).toHaveAttribute("aria-disabled", "true");
  expect(button).toHaveAccessibleDescription(OFFLINE);
  expect(button).toHaveFocus();
  await user.click(button);
  expect(writes).toEqual([]);
}

// AC2 (F-15: akcje zapisu nieaktywne bez połączenia).
describe("write actions while offline", () => {
  let writes: string[];
  beforeEach(() => {
    sessionIs(ANIA);
    liveServer();
    writes = writesSent();
  });
  afterEach(() => {
    server.events.removeAllListeners();
  });

  it("SC-05: „+ Nowa lista” is inactive and opens nothing", async () => {
    listsAre([aList({ name: "Dom" })]);
    renderApp("/listy");
    const create = await screen.findByRole("button", { name: "+ Nowa lista" });

    await expectInactiveOffline(create, writes);

    expect(screen.queryByRole("textbox", { name: "Nazwa listy" })).not.toBeInTheDocument();
  });

  it("SC-06: AddBar, checkboxes, editing and „Usuń wszystkie kupione” are inactive", async () => {
    const user = userEvent.setup();
    const list = aList({ name: "Dom" });
    const bread = anItem({ name: "Chleb" });
    const butter = anItem({ name: "Masło", checked: true, checkedBy: ANIA });
    server.use(
      http.get(`*/api/v1/lists/${list.id}`, () =>
        HttpResponse.json(detailsOf(list, [bread, butter])),
      ),
    );
    listsAre([list]);
    renderApp(`/listy/${list.id}`);
    const add = await screen.findByRole("button", { name: "Dodaj pozycję" });
    await screen.findByText("1 do kupienia");
    await user.type(screen.getByRole("textbox", { name: "Co kupić?" }), "Mleko");

    await expectInactiveOffline(add, writes);
    await user.type(screen.getByRole("textbox", { name: "Co kupić?" }), "{Enter}");
    expect(writes).toEqual([]);
    // Wpisany tekst zostaje: nic nie zostało zapisane ani zgubione.
    expect(screen.getByRole("textbox", { name: "Co kupić?" })).toHaveValue("Mleko");

    await expectInactive(screen.getByRole("button", { name: "Odhacz Chleb" }), writes);
    await expectInactive(screen.getByRole("button", { name: "Edytuj Chleb" }), writes);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Kupione \(1\)/ }));
    await expectInactive(screen.getByRole("button", { name: "Usuń wszystkie kupione" }), writes);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("SC-07: „Utwórz link zaproszenia” and „Unieważnij” are inactive, „Kopiuj” works", async () => {
    const user = userEvent.setup();
    const list = aList({ name: "Dom" });
    const link = {
      id: "inv-1",
      url: `http://localhost/zaproszenie/${"x".repeat(43)}`,
      expiresAt: "2026-11-09T10:00:00.000Z",
    };
    server.use(
      ...listHandlers(list),
      http.get(`*/api/v1/lists/${list.id}/invitations`, () => HttpResponse.json([link])),
    );
    renderApp(`/listy/${list.id}/uczestnicy`);
    const create = await screen.findByRole("button", { name: "Utwórz link zaproszenia" });
    const revoke = await screen.findByRole("button", { name: "Unieważnij" });

    await expectInactiveOffline(create, writes);
    await expectInactive(revoke, writes);

    const copy = screen.getByRole("button", { name: "Kopiuj" });
    expect(copy).not.toHaveAttribute("aria-disabled");
    // Po `userEvent.setup()` (podmienia schowek).
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await user.click(copy);
    expect(writeText).toHaveBeenCalledWith(link.url);
  });

  it("SC-09: „Wyloguj się” works: the request goes out at once, not queued until online", async () => {
    const user = userEvent.setup();
    server.use(http.post("*/api/auth/sign-out", () => HttpResponse.json({ success: true })));
    renderApp("/konto");
    const logout = await screen.findByRole("button", { name: "Wyloguj się" });
    browserGoes("offline");
    await screen.findByText(OFFLINE);
    expect(logout).not.toHaveAttribute("aria-disabled");

    sessionIs(null);
    await user.click(logout);

    await screen.findByRole("heading", { level: 1, name: "Zaloguj się" });
    expect(writes).toEqual(["POST /api/auth/sign-out"]);
  });
});
