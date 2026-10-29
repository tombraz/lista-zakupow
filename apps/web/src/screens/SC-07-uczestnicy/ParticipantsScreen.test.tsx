import type { Invitation, ListSummary } from "@lista/shared";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { aList, ANIA, apiError, detailsOf, TOMEK } from "../../../test/lists";
import { server } from "../../../test/msw-server";
import { heldResponse } from "../../../test/held";
import { renderApp, sessionIs } from "../../../test/render";

const EXPIRES = "2026-11-09T10:00:00.000Z";

function anInvitation(id: string): Invitation {
  return { id, url: `http://localhost/zaproszenie/${id.padEnd(43, "x")}`, expiresAt: EXPIRES };
}

/** SC-07 właściciela listy „Dom” z podanymi aktywnymi linkami (stan serwera w `links`). */
async function showParticipants(
  options: { links?: Invitation[]; list?: Partial<ListSummary> } = {},
) {
  const user = userEvent.setup();
  const list = aList({ name: "Dom", ...options.list });
  const links = { current: options.links ?? [] };
  server.use(
    http.get(`*/api/v1/lists/${list.id}`, () => HttpResponse.json(detailsOf(list))),
    http.get(`*/api/v1/lists/${list.id}/invitations`, () => HttpResponse.json(links.current)),
  );
  renderApp(`/listy/${list.id}/uczestnicy`);
  await screen.findByRole("heading", { level: 1, name: "Uczestnicy" });
  await screen.findByRole("region", { name: "Zaproszenia" });
  return { user, list, links };
}

const invitationsSection = () => within(screen.getByRole("region", { name: "Zaproszenia" }));

const linkBoxes = () => invitationsSection().queryAllByRole("group");

function withClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
}

// AC1, AC2, AC6, AC8 (F-11): sekcja „Zaproszenia” właściciela na SC-07.
describe("SC-07 invitations of the owner", () => {
  beforeEach(() => {
    sessionIs(ANIA);
  });

  it("shows the owner row, the empty state, the hint and the create button", async () => {
    await showParticipants();

    const members = within(screen.getByRole("region", { name: "Na liście (0 z 20)" }));
    expect(members.getByText("Ania")).toBeVisible();
    expect(members.getByText("właściciel · Ty")).toBeVisible();
    expect(
      await screen.findByText("Nikt jeszcze nie dołączył. Utwórz link i wyślij go domownikowi."),
    ).toBeVisible();
    expect(
      invitationsSection().getByText(
        "Link działa dla jednej osoby przez 7 dni. Wyślij go SMS-em lub komunikatorem.",
      ),
    ).toBeVisible();
    expect(
      invitationsSection().getByRole("button", { name: "Utwórz link zaproszenia" }),
    ).toBeEnabled();
  });

  it("shows each active link with its expiry date, read-only address, Kopiuj and Unieważnij", async () => {
    const link = anInvitation("a");
    await showParticipants({ links: [link] });

    const box = within(await invitationsSection().findByRole("group"));
    expect(box.getByText("Link jednorazowy, ważny do 9 listopada")).toBeVisible();
    const address = box.getByRole("textbox", { name: "Link jednorazowy, ważny do 9 listopada" });
    expect(address).toHaveValue(link.url);
    expect(address).toHaveAttribute("readonly");
    expect(box.getByRole("button", { name: "Kopiuj" })).toBeVisible();
    expect(box.getByRole("button", { name: "Unieważnij" })).toBeVisible();
  });

  it("creates a link once while saving and shows it on top with focus on Kopiuj (AC1)", async () => {
    const old = anInvitation("old");
    const { user, list, links } = await showParticipants({ links: [old] });
    const created = anInvitation("new");
    const response = heldResponse();
    let posts = 0;
    server.use(
      http.post(`*/api/v1/lists/${list.id}/invitations`, async () => {
        posts += 1;
        await response.released;
        links.current = [created, old];
        return HttpResponse.json(created, { status: 201 });
      }),
    );
    await invitationsSection().findByRole("group");
    const create = invitationsSection().getByRole("button", { name: "Utwórz link zaproszenia" });

    await user.click(create);
    await user.click(create);
    response.release();

    await waitFor(() => {
      expect(linkBoxes()).toHaveLength(2);
    });
    expect(posts).toBe(1);
    const [first] = linkBoxes();
    expect(within(first as HTMLElement).getByRole("textbox")).toHaveValue(created.url);
    await waitFor(() => {
      expect(within(first as HTMLElement).getByRole("button", { name: "Kopiuj" })).toHaveFocus();
    });
  });

  // T-020: blokada nie czeka na przerysowanie przycisku w stanie zapisu.
  it("creates a link once when clicked twice before the button re-renders (T-020)", async () => {
    const { list } = await showParticipants();
    let posts = 0;
    server.use(
      http.post(`*/api/v1/lists/${list.id}/invitations`, () => {
        posts += 1;
        return HttpResponse.json(anInvitation("new"), { status: 201 });
      }),
    );
    const create = invitationsSection().getByRole("button", { name: "Utwórz link zaproszenia" });

    fireEvent.click(create);
    fireEvent.click(create);

    await waitFor(() => {
      expect(linkBoxes()).toHaveLength(1);
    });
    expect(posts).toBe(1);
  });

  // T-015: w czasie zapisu przycisk zostaje fokusowalny (aria-disabled zamiast disabled).
  it("keeps focus on „Utwórz link zaproszenia” while saving", async () => {
    const { user, list } = await showParticipants();
    server.use(
      http.post(`*/api/v1/lists/${list.id}/invitations`, async () => {
        await delay("infinite");
        return HttpResponse.json(anInvitation("new"), { status: 201 });
      }),
    );
    const create = invitationsSection().getByRole("button", { name: "Utwórz link zaproszenia" });

    create.focus();
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(create).toHaveAttribute("aria-busy", "true");
    });
    expect(create).toHaveAttribute("aria-disabled", "true");
    expect(create).not.toBeDisabled();
    expect(create).toHaveFocus();
  });

  it("copies the link and confirms with a status toast", async () => {
    const link = anInvitation("a");
    const { user } = await showParticipants({ links: [link] });
    const writeText = vi.fn(() => Promise.resolve());
    withClipboard(writeText);

    await user.click(await invitationsSection().findByRole("button", { name: "Kopiuj" }));

    expect(writeText).toHaveBeenCalledWith(link.url);
    const toast = await screen.findByText("Link skopiowany");
    expect(toast.closest("[role=status]")).not.toBeNull();
  });

  it("selects the link and asks to copy it manually when the clipboard is unavailable (AC8)", async () => {
    const link = anInvitation("a");
    const { user } = await showParticipants({ links: [link] });
    withClipboard(() => Promise.reject(new Error("denied")));

    await user.click(await invitationsSection().findByRole("button", { name: "Kopiuj" }));

    expect(await screen.findByText("Skopiuj link ręcznie.")).toBeVisible();
    const address = invitationsSection().getByRole<HTMLInputElement>("textbox");
    expect(address).toHaveFocus();
    expect(address.selectionStart).toBe(0);
    expect(address.selectionEnd).toBe(link.url.length);
    expect(screen.queryByText("Link skopiowany")).not.toBeInTheDocument();
  });

  it("revokes a link: it disappears, „Link unieważniony” is announced, focus on create (AC2)", async () => {
    const link = anInvitation("a");
    const { user, list, links } = await showParticipants({ links: [link] });
    server.use(
      http.delete(`*/api/v1/lists/${list.id}/invitations/${link.id}`, () => {
        links.current = [];
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await user.click(await invitationsSection().findByRole("button", { name: "Unieważnij" }));

    await waitFor(() => {
      expect(linkBoxes()).toHaveLength(0);
    });
    expect(screen.getByText("Link unieważniony")).toHaveAttribute("role", "status");
    expect(
      invitationsSection().getByRole("button", { name: "Utwórz link zaproszenia" }),
    ).toHaveFocus();
  });

  // T-020: jedno żądanie na link, ale różne linki unieważniane niezależnie.
  it("revokes a link once when clicked twice, and another link meanwhile (T-020)", async () => {
    const [a, b] = [anInvitation("a"), anInvitation("b")];
    const { list, links } = await showParticipants({ links: [a, b] });
    const deletes: string[] = [];
    server.use(
      http.delete(`*/api/v1/lists/${list.id}/invitations/:id`, async ({ params }) => {
        deletes.push(String(params["id"]));
        // eslint-disable-next-line no-restricted-syntax -- kliknięcia synchroniczne (fireEvent), delay nie jest oknem na kroki testu (T-021)
        await delay(50);
        links.current = links.current.filter(({ id }) => id !== params["id"]);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await waitFor(() => {
      expect(linkBoxes()).toHaveLength(2);
    });
    const [first, second] = invitationsSection().getAllByRole("button", { name: "Unieważnij" });

    fireEvent.click(first as HTMLElement);
    fireEvent.click(first as HTMLElement);
    fireEvent.click(second as HTMLElement);

    await waitFor(() => {
      expect(linkBoxes()).toHaveLength(0);
    });
    expect(deletes.sort()).toEqual(["a", "b"]);
  });

  it("after a lost revoke response shows the server state and an error", async () => {
    const link = anInvitation("a");
    const { user, list, links } = await showParticipants({ links: [link] });
    server.use(
      http.delete(`*/api/v1/lists/${list.id}/invitations/${link.id}`, () => {
        links.current = [];
        return HttpResponse.error();
      }),
    );

    await user.click(await invitationsSection().findByRole("button", { name: "Unieważnij" }));

    expect(
      await screen.findByText("Brak połączenia. Sprawdź internet i spróbuj ponownie."),
    ).toBeVisible();
    await waitFor(() => {
      expect(linkBoxes()).toHaveLength(0);
    });
  });

  it("after a lost create response shows the link the server created", async () => {
    const { user, list, links } = await showParticipants();
    const created = anInvitation("new");
    server.use(
      http.post(`*/api/v1/lists/${list.id}/invitations`, () => {
        links.current = [created];
        return HttpResponse.error();
      }),
    );

    await user.click(invitationsSection().getByRole("button", { name: "Utwórz link zaproszenia" }));

    expect(
      await screen.findByText("Brak połączenia. Sprawdź internet i spróbuj ponownie."),
    ).toBeVisible();
    await waitFor(() => {
      expect(linkBoxes()).toHaveLength(1);
    });
  });

  it("at 20 participants warns about the limit and disables create (AC6)", async () => {
    const members = Array.from({ length: 20 }, (_, index) => ({
      id: `u-${String(index)}`,
      name: `Osoba ${String(index)}`,
    }));
    await showParticipants({ list: { members } });

    expect(
      await screen.findByText(
        "Lista ma 20 uczestników — to limit. Usuń kogoś, żeby zaprosić nową osobę.",
      ),
    ).toBeVisible();
    expect(
      invitationsSection().getByRole("button", { name: "Utwórz link zaproszenia" }),
    ).toBeDisabled();
  });

  it("shows the limit warning when the API answers limit_reached and refreshes the list", async () => {
    const { user, list } = await showParticipants();
    const full = {
      ...list,
      members: Array.from({ length: 20 }, (_, index) => ({ id: `u-${String(index)}`, name: "X" })),
    };
    server.use(
      http.post(`*/api/v1/lists/${list.id}/invitations`, () => {
        server.use(http.get(`*/api/v1/lists/${list.id}`, () => HttpResponse.json(detailsOf(full))));
        return apiError(409, { code: "limit_reached", limit: "participants" });
      }),
    );

    await user.click(invitationsSection().getByRole("button", { name: "Utwórz link zaproszenia" }));

    expect(
      await screen.findByText(
        "Lista ma 20 uczestników — to limit. Usuń kogoś, żeby zaprosić nową osobę.",
      ),
    ).toBeVisible();
    await waitFor(() => {
      expect(
        invitationsSection().getByRole("button", { name: "Utwórz link zaproszenia" }),
      ).toBeDisabled();
    });
  });

  it("says the participants did not load and loads them again on request", async () => {
    const user = userEvent.setup();
    const list = aList({ name: "Dom" });
    server.use(
      http.get(`*/api/v1/lists/${list.id}`, () => HttpResponse.json(detailsOf(list))),
      http.get(`*/api/v1/lists/${list.id}/invitations`, () => apiError(500, { code: "internal" }), {
        once: true,
      }),
      http.get(`*/api/v1/lists/${list.id}/invitations`, () => HttpResponse.json([])),
    );
    renderApp(`/listy/${list.id}/uczestnicy`);

    expect(await screen.findByText("Nie udało się wczytać uczestników.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Spróbuj ponownie" }));
    expect(await screen.findByRole("button", { name: "Utwórz link zaproszenia" })).toBeEnabled();
  });
});

// SEC3 (TH-02): ikona „Uczestnicy” na SC-06 tylko dla właściciela.
describe("SC-06 Uczestnicy icon", () => {
  it("is a link to SC-07 for the owner and absent for a participant", async () => {
    sessionIs(ANIA);
    const own = aList({ name: "Dom" });
    const shared = aList({ name: "Działka", role: "participant", owner: TOMEK });
    server.use(
      http.get(`*/api/v1/lists/${own.id}`, () => HttpResponse.json(detailsOf(own))),
      http.get(`*/api/v1/lists/${shared.id}`, () => HttpResponse.json(detailsOf(shared))),
    );

    const view = renderApp(`/listy/${own.id}`);
    await screen.findByRole("heading", { level: 1, name: "Dom" });
    expect(screen.getByRole("link", { name: "Uczestnicy" })).toHaveAttribute(
      "href",
      `/listy/${own.id}/uczestnicy`,
    );
    view.unmount();

    renderApp(`/listy/${shared.id}`);
    await screen.findByRole("heading", { level: 1, name: "Działka" });
    expect(screen.queryByRole("link", { name: "Uczestnicy" })).not.toBeInTheDocument();
  });
});
