import type { Me } from "@lista/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, type InitialEntry } from "react-router";
import { RouterProvider } from "react-router/dom";
import { routes } from "../src/routes";
import { aList, anItem, ANIA, detailsOf } from "./lists";
import { server } from "./msw-server";

function testQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

/** Domownik zalogowany (`/api/v1/me` 200) albo anonim (401). */
export function sessionIs(user: Me | null) {
  server.use(
    http.get("*/api/v1/me", () =>
      user
        ? HttpResponse.json(user)
        : HttpResponse.json({ error: { code: "unauthenticated" } }, { status: 401 }),
    ),
  );
}

/** Cała aplikacja (trasy jak w przeglądarce) od podanego adresu (ostatniego z historii). */
export function renderApp(entry: InitialEntry | InitialEntry[]) {
  const initialEntries = Array.isArray(entry) ? entry : [entry];
  const router = createMemoryRouter(routes, {
    initialEntries,
    initialIndex: initialEntries.length - 1,
  });
  const view = render(
    <QueryClientProvider client={testQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...view, router };
}

/**
 * Jedno wejście na SC-06 przed testami pliku (`setup.ts`). Pierwszy render w świeżym workerze
 * (kompilacja Reacta i jsdom, pierwsze żądanie MSW, pierwsze wyliczenie nazwy dostępnej) trwał
 * pod obciążeniem ponad 1 s i nie mieścił się w limicie `findBy*` pierwszego testu (T-021).
 * Rozgrzewka to nie test: czeka do limitu haka, bo sprawdza tylko, że aplikacja wstała.
 */
export async function warmUp() {
  const list = aList({ name: "Rozgrzewka" });
  sessionIs(ANIA);
  server.use(
    http.get(`*/api/v1/lists/${list.id}`, () =>
      HttpResponse.json(detailsOf(list, [anItem({ name: "Chleb" })])),
    ),
  );
  const view = renderApp(`/listy/${list.id}`);
  await screen.findByRole("heading", { level: 1, name: list.name }, { timeout: 8_000 });
  view.unmount();
  server.resetHandlers();
}
