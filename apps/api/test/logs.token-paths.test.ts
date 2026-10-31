import { readFileSync } from "node:fs";
import type { FastifyInstance } from "fastify";
import { describe, expect, it } from "vitest";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { redactedUrl } from "../src/logging";

/**
 * Każda trasa zarejestrowana w aplikacji, z drzewa `printRoutes` (węzeł z metodami to trasa,
 * poziom co 4 znaki wcięcia). Bez `vi.mock("fastify")`: projekt `api` ma `isolate: false`, więc
 * mock modułu załadowanego już przez inny plik w tym samym wątku nie działa.
 */
function registeredRoutes(app: FastifyInstance): string[] {
  const parents: string[] = [];
  const routes: string[] = [];
  for (const line of app.printRoutes({ commonPrefix: false }).split("\n")) {
    const node = /^([│ ]*)[├└]── (\S+)( \([^)]*\))?$/.exec(line);
    if (!node) continue;
    parents.length = (node[1] ?? "").length / 4;
    parents.push(node[2] ?? "");
    if (node[3]) routes.push(parents.join(""));
  }
  return routes;
}

// Strony web z tokenem w ścieżce (SC-08) serwuje API przez fallback SPA (ADR 0006).
const WEB_ROUTES = new URL("../../web/src/routes.tsx", import.meta.url);

// Każde `path:` w pliku musi być literałem w cudzysłowie; inny zapis (stała, szablon) zawodzi
// test, zamiast po cichu zgubić stronę.
function webTokenPaths(): string[] {
  const source = readFileSync(WEB_ROUTES, "utf8");
  const paths = [...source.matchAll(/path:\s*"([^"]*)"/g)].map((match) => match[1] ?? "");
  expect(paths).toHaveLength([...source.matchAll(/\bpath:/g)].length);
  return paths.filter((path) => path.includes(":token"));
}

const TOKEN = "Kq3vZ8pLw2XnR5tY7uB1cD4eF6gH9jM0oN-sA_iE3rT";

const escaped = (text: string) => `%${text.charCodeAt(0).toString(16)}${text.slice(1)}`;

/** TH-26: zapisy ścieżki, które router kieruje do tej samej trasy co kanoniczny. */
function spellings(pattern: string): string[] {
  const segments = pattern.split("/").filter(Boolean);
  const path = (spell: (segment: string, index: number) => string) =>
    `/${segments.map((segment, index) => spell(segment, index)).join("/")}`;
  const concrete = (segment: string) =>
    segment === ":token" ? TOKEN : segment.startsWith(":") ? "x" : segment;
  return [
    path(concrete),
    ...segments.map((_segment, at) =>
      path((segment, index) => (index === at ? escaped(concrete(segment)) : concrete(segment))),
    ),
    path((segment) => (segment === ":token" ? `A%2F${TOKEN}` : concrete(segment))),
    `/${path(concrete)}`,
    `${path(concrete)}?x=1`,
  ];
}

// T-051: redakcja w logu zna ścieżki z tokenem z góry; nowa trasa albo strona z `:token` bez
// redakcji zawodzi ten test, zanim token trafi do logu.
describe("token paths in logs (TH-08, TH-26)", () => {
  const db = useTestDatabase();

  it("redacts the token of every API route and web page with :token, whatever the spelling", async () => {
    const app = buildTestApp(db.pool);
    await app.ready();
    const routes = registeredRoutes(app);
    await app.close();
    expect(routes).toContain("/api/v1/lists/:listId/items/:itemId");
    const apiPaths = routes.filter((url) => url.includes(":token"));
    expect(apiPaths).toEqual(
      expect.arrayContaining(["/api/v1/invitations/:token", "/api/v1/invitations/:token/accept"]),
    );
    expect(webTokenPaths()).toContain("/zaproszenie/:token");

    for (const pattern of [...apiPaths, ...webTokenPaths()]) {
      for (const url of spellings(pattern)) {
        const logged = redactedUrl(url);
        expect({ url, logged, leaks: logged.includes(TOKEN.slice(1)) }).toEqual({
          url,
          logged,
          leaks: false,
        });
        expect(logged).toContain("[redacted]");
      }
    }
  });
});
