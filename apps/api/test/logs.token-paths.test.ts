import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { redactedUrl } from "../src/logging";

// Każda trasa zarejestrowana w aplikacji: hook `onRoute` od razu po utworzeniu instancji, przed
// trasami z `buildApp`.
const registered = vi.hoisted(() => [] as string[]);
vi.mock("fastify", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fastify")>();
  const fastify = ((options: Parameters<typeof actual.default>[0]) => {
    const app = actual.default(options);
    app.addHook("onRoute", (route) => {
      registered.push(route.url);
    });
    return app;
  }) as typeof actual.default;
  return { ...actual, default: fastify };
});

// Strony web z tokenem w ścieżce (SC-08) serwuje API przez fallback SPA (ADR 0006).
const WEB_ROUTES = new URL("../../web/src/routes.tsx", import.meta.url);

function webTokenPaths(): string[] {
  const source = readFileSync(WEB_ROUTES, "utf8");
  return [...source.matchAll(/path:\s*"([^"]*:token[^"]*)"/g)].map((match) => match[1] ?? "");
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
    const apiPaths = [...new Set(registered.filter((url) => url.includes(":token")))];
    await app.close();
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
