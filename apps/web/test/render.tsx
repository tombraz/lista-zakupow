import type { Me } from "@lista/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider, type InitialEntry } from "react-router";
import { routes } from "../src/routes";
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
