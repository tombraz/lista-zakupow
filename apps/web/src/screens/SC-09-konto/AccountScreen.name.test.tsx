import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { heldResponse } from "../../../test/held";
import { browserGoes } from "../../../test/live";
import { server } from "../../../test/msw-server";
import { renderApp, sessionIs } from "../../../test/render";

const TOMEK = { id: "u-2", name: "Tomek", email: "tomek@example.com" };

/** `PATCH /api/v1/me` odpowiada imieniem z treści żądania (po `trim`, jak API). */
function nameChangeSaves(options: { held?: ReturnType<typeof heldResponse> } = {}) {
  const sent: unknown[] = [];
  server.use(
    http.patch("*/api/v1/me", async ({ request }) => {
      const body = (await request.json()) as { name: string };
      sent.push(body);
      await options.held?.released;
      return HttpResponse.json({ ...TOMEK, name: body.name.trim() });
    }),
  );
  return sent;
}

async function openAccount() {
  const user = userEvent.setup();
  const view = renderApp("/konto");
  const field = await screen.findByRole("textbox", { name: "Imię" });
  return { user, field, ...view };
}

async function typeName(
  user: ReturnType<typeof userEvent.setup>,
  field: HTMLElement,
  name: string,
) {
  await user.clear(field);
  if (name) await user.type(field, name);
}

// T-061 AC4 (F-16): zmiana imienia na SC-09.
describe("SC-09 Konto: changing the name", () => {
  beforeEach(() => {
    sessionIs(TOMEK);
  });

  it("shows the name field with its description and autocomplete", async () => {
    const { field } = await openAccount();

    expect(field).toHaveValue("Tomek");
    expect(field).toHaveAccessibleDescription("Tak zobaczą Cię inni na wspólnych listach.");
    expect(field).toHaveAttribute("autocomplete", "given-name");
    expect(screen.getByText("tomek@example.com")).toBeVisible();
  });

  it("saves the name, announces „Imię zmienione” and keeps the new name in the session", async () => {
    const sent = nameChangeSaves();
    const { user, field, router } = await openAccount();

    await typeName(user, field, "Tomasz");
    await user.click(screen.getByRole("button", { name: "Zapisz imię" }));

    const toast = await screen.findByText("Imię zmienione");
    expect(toast.closest('[role="status"]')).not.toBeNull();
    expect(sent).toEqual([{ name: "Tomasz" }]);
    expect(field).toHaveValue("Tomasz");
    // `GET /api/v1/me` w MSW dalej zwraca „Tomek”: nowe imię pochodzi z sesji klienta.
    await act(() => router.navigate("/regulamin"));
    await act(() => router.navigate("/konto"));
    expect(await screen.findByRole("textbox", { name: "Imię" })).toHaveValue("Tomasz");
  });

  it("keeps loading in the button and focus on it while saving", async () => {
    const held = heldResponse();
    nameChangeSaves({ held });
    const { user, field } = await openAccount();
    await typeName(user, field, "Tomasz");
    const save = screen.getByRole("button", { name: "Zapisz imię" });

    save.focus();
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(save).toHaveAttribute("aria-busy", "true");
    });
    expect(save).toHaveAttribute("aria-disabled", "true");
    expect(save).toHaveFocus();
    held.release();
    expect(await screen.findByText("Imię zmienione")).toBeVisible();
  });

  it("saves once when clicked twice before the button re-renders", async () => {
    const sent = nameChangeSaves();
    const { user, field } = await openAccount();
    await typeName(user, field, "Tomasz");
    const save = screen.getByRole("button", { name: "Zapisz imię" });

    act(() => {
      fireEvent.click(save);
      fireEvent.click(save);
    });

    expect(await screen.findByText("Imię zmienione")).toBeVisible();
    expect(sent).toHaveLength(1);
  });

  it.each([
    ["", "Wpisz imię"],
    ["   ", "Wpisz imię"],
    ["a".repeat(31), "Imię może mieć najwyżej 30 znaków"],
  ])(
    "shows the field error for „%s” under the field with focus on it, without saving",
    async (name, text) => {
      const sent = nameChangeSaves();
      const { user, field } = await openAccount();
      await typeName(user, field, name);

      await user.click(screen.getByRole("button", { name: "Zapisz imię" }));

      expect(field).toHaveAccessibleDescription(
        `Tak zobaczą Cię inni na wspólnych listach. ${text}`,
      );
      expect(field).toHaveAttribute("aria-invalid", "true");
      expect(field).toHaveFocus();
      expect(sent).toEqual([]);
    },
  );

  it("shows the field error returned by the API with focus on the field", async () => {
    server.use(
      http.patch("*/api/v1/me", () =>
        HttpResponse.json(
          { error: { code: "validation_failed", fields: { name: "invalid" } } },
          { status: 400 },
        ),
      ),
    );
    const { user, field } = await openAccount();
    await typeName(user, field, "Tomasz");

    await user.click(screen.getByRole("button", { name: "Zapisz imię" }));

    await waitFor(() => {
      expect(field).toHaveFocus();
    });
    expect(field).toHaveAccessibleDescription(
      "Tak zobaczą Cię inni na wspólnych listach. Usuń niewidoczne lub specjalne znaki.",
    );
  });

  it("says the save failed when the server answers with an error, and keeps the typed name", async () => {
    server.use(
      http.patch("*/api/v1/me", () =>
        HttpResponse.json({ error: { code: "internal" } }, { status: 500 }),
      ),
    );
    const { user, field } = await openAccount();
    await typeName(user, field, "Tomasz");

    await user.click(screen.getByRole("button", { name: "Zapisz imię" }));

    expect(await screen.findByText("Nie udało się zapisać. Spróbuj ponownie.")).toBeVisible();
    expect(field).toHaveValue("Tomasz");
    expect(screen.queryByText("Imię zmienione")).toBeNull();
  });

  it("makes „Zapisz imię” inactive offline while „Wyloguj się” still works", async () => {
    const sent = nameChangeSaves();
    const { user, field } = await openAccount();
    await typeName(user, field, "Tomasz");

    browserGoes("offline");
    const save = screen.getByRole("button", { name: "Zapisz imię" });
    await user.click(save);

    expect(save).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Wyloguj się" })).not.toHaveAttribute(
      "aria-disabled",
    );
    expect(sent).toEqual([]);
    browserGoes("online");
  });
});

// TDD plan, „Client state during writes”.
describe("SC-09 Konto: name change while writing", () => {
  beforeEach(() => {
    sessionIs(TOMEK);
  });

  it("does not overwrite what the user typed while the save was in flight", async () => {
    const held = heldResponse();
    nameChangeSaves({ held });
    const { user, field } = await openAccount();
    await typeName(user, field, "Tomasz");
    await user.click(screen.getByRole("button", { name: "Zapisz imię" }));

    await user.type(field, " B.");
    held.release();

    expect(await screen.findByText("Imię zmienione")).toBeVisible();
    expect(field).toHaveValue("Tomasz B.");
  });

  it("saves the same name again after a lost response", async () => {
    let calls = 0;
    server.use(
      http.patch("*/api/v1/me", async ({ request }) => {
        calls += 1;
        const body = (await request.json()) as { name: string };
        if (calls === 1) return HttpResponse.error();
        return HttpResponse.json({ ...TOMEK, name: body.name });
      }),
    );
    const { user, field } = await openAccount();
    await typeName(user, field, "Tomasz");
    const save = screen.getByRole("button", { name: "Zapisz imię" });

    await user.click(save);
    expect(
      await screen.findByText("Brak połączenia. Sprawdź internet i spróbuj ponownie."),
    ).toBeVisible();
    await user.click(save);

    expect(await screen.findByText("Imię zmienione")).toBeVisible();
    expect(screen.queryByText(/Brak połączenia/)).toBeNull();
    expect(field).toHaveValue("Tomasz");
  });
});
