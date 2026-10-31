import { fileURLToPath } from "node:url";
import { RATE_LIMITS } from "@lista/shared";
import { describe, expect, it } from "vitest";
import { buildTestApp, TEST_ORIGIN } from "./app";
import { useTestDatabase } from "./database";
import { createInvitation, createList, createUser, randomIp } from "./factories";
import { captureLogs } from "./logs";
import { requestsAs } from "./requests";

const webDistDir = fileURLToPath(new URL("./fixtures/web-dist", import.meta.url));

// SEC5 (TH-08): token zaproszenia nie trafia do logów API.
describe("invitation token in logs", () => {
  const db = useTestDatabase();

  it("redacts the token in the logged path of preview and accept", async () => {
    const logs = captureLogs();
    const app = buildTestApp(db.pool, { logger: { level: "info", stream: logs.stream } });
    const ania = await createUser(app);
    const tomek = await createUser(app);
    const list = await createList(db.pool, ania);
    const link = await createInvitation(db.pool, list);
    const used = await createInvitation(db.pool, list);
    await requestsAs(app, tomek)("POST", `/api/v1/invitations/${used.token}/accept`);

    await requestsAs(app, null)("GET", `/api/v1/invitations/${link.token}?x=1`);
    await requestsAs(app, tomek)("POST", `/api/v1/invitations/${link.token}/accept`);
    await requestsAs(app, tomek)("POST", `/api/v1/invitations/${used.token}/accept`);

    const all = logs.lines.join("\n");
    expect(all).not.toContain(link.token);
    expect(all).not.toContain(used.token);
    const urls = logs
      .entries()
      .map((entry) => (entry["req"] as { url?: string } | undefined)?.url)
      .filter((url) => url?.startsWith("/api/v1/invitations/"));
    expect(urls).toEqual(
      expect.arrayContaining([
        "/api/v1/invitations/[redacted]?x=1",
        "/api/v1/invitations/[redacted]/accept",
      ]),
    );
    await app.close();
  });

  // QA round 1 #1: API serwuje też SPA, więc otwarcie linku (`/zaproszenie/<token>`) loguje się.
  it("redacts the token in the logged path of the SC-08 page", async () => {
    const logs = captureLogs();
    const app = buildTestApp(db.pool, {
      webDistDir,
      logger: { level: "info", stream: logs.stream },
    });
    const ania = await createUser(app);
    const list = await createList(db.pool, ania);
    const link = await createInvitation(db.pool, list);

    const page = await app.inject({ method: "GET", url: `/zaproszenie/${link.token}?x=1` });

    expect(page.headers["content-type"]).toContain("text/html");
    expect(logs.lines.join("\n")).not.toContain(link.token);
    const urls = logs
      .entries()
      .map((entry) => (entry["req"] as { url?: string } | undefined)?.url)
      .filter((url) => url?.startsWith("/zaproszenie/"));
    expect(urls).toContain("/zaproszenie/[redacted]?x=1");
    await app.close();
  });

  /**
   * T-051 (TH-26): router dopasowuje trasę po zdekodowanej ścieżce, więc każdy z tych zapisów
   * trafia do trasy z tokenem; redakcja nie może zależeć od zapisu prefiksu ani tokenu.
   */
  function tokenPathSpellings(prefix: string, token: string, suffix = ""): string[] {
    const encodedToken = `%${token.charCodeAt(0).toString(16)}${token.slice(1)}`;
    const segments = prefix.split("/").filter(Boolean);
    return [
      ...segments.map((_segment, index) => {
        const spelled = segments.map((s, i) =>
          i === index ? `%${s.charCodeAt(0).toString(16)}${s.slice(1)}` : s,
        );
        return `/${spelled.join("/")}/${token}${suffix}`;
      }),
      `${prefix}${encodedToken}${suffix}`,
      `${prefix}${token}%zz${suffix}`,
      `${prefix}A%2F${token}${suffix}`,
      `${prefix}${token}${suffix}?x=1`,
      `${prefix}${token}${suffix}?x=%zz`,
      `/${prefix}${token}${suffix}`,
    ];
  }

  // Poza tokenem wystarczająco długim, by nie pojawił się przypadkiem; obejmuje token z
  // zakodowanym pierwszym znakiem.
  const tokenTail = (token: string) => token.slice(1);

  // Ścieżkę z nieprawidłową sekwencją `%` Fastify odrzuca 400 przed routerem i nie loguje żądania.
  const logged = (url: string) => !/^[^?]*%zz/.test(url);

  function loggedUrls(logs: ReturnType<typeof captureLogs>): string[] {
    return logs
      .entries()
      .map((entry) => (entry["req"] as { url?: string } | undefined)?.url)
      .filter((url): url is string => url !== undefined);
  }

  it("redacts the invitation token whatever the path spelling", async () => {
    const logs = captureLogs();
    const app = buildTestApp(db.pool, { logger: { level: "info", stream: logs.stream } });
    const ania = await createUser(app);
    const tomek = await createUser(app);
    const list = await createList(db.pool, ania);
    const link = await createInvitation(db.pool, list);
    logs.lines.length = 0;

    const requests = [
      ...tokenPathSpellings("/api/v1/invitations/", link.token).map((url) => ({
        method: "GET" as const,
        url,
      })),
      ...tokenPathSpellings("/api/v1/invitations/", link.token, "/accept").map((url) => ({
        method: "POST" as const,
        url,
      })),
    ];
    for (const { method, url } of requests) {
      const response = await app.inject({
        method,
        url,
        headers: { origin: TEST_ORIGIN, cookie: tomek.cookie },
        remoteAddress: randomIp(),
      });
      expect({ url, status: response.statusCode < 500 }).toEqual({ url, status: true });
    }

    expect(logs.lines.join("\n")).not.toContain(tokenTail(link.token));
    const urls = loggedUrls(logs);
    expect(urls).toHaveLength(requests.filter(({ url }) => logged(url)).length);
    for (const url of urls) {
      expect(url).toMatch(/^\/api\/v1\/invitations\/\[redacted\](\/accept)?(\?x=(1|%zz))?$/);
    }
    await app.close();
  });

  it("redacts the token of the SC-08 page whatever the path spelling", async () => {
    const logs = captureLogs();
    const app = buildTestApp(db.pool, {
      webDistDir,
      logger: { level: "info", stream: logs.stream },
    });
    const ania = await createUser(app);
    const list = await createList(db.pool, ania);
    const link = await createInvitation(db.pool, list);
    logs.lines.length = 0;

    const spellings = tokenPathSpellings("/zaproszenie/", link.token);
    for (const url of spellings) await app.inject({ method: "GET", url });

    expect(logs.lines.join("\n")).not.toContain(tokenTail(link.token));
    const urls = loggedUrls(logs);
    expect(urls).toHaveLength(spellings.filter(logged).length);
    for (const url of urls) expect(url).toMatch(/^\/zaproszenie\/\[redacted\](\?x=(1|%zz))?$/);
    await app.close();
  });

  // T-027 (TH-06, TH-21): odgadywanie tokenu zostawia ślad w logu `security`.
  it.each([
    ["GET", "/api/v1/invitations/:token", ""],
    ["POST", "/api/v1/invitations/:token/accept", "/accept"],
  ] as const)(
    "logs a security event when invitation lookups exceed the IP limit (%s %s)",
    async (method, route, suffix) => {
      const logs = captureLogs();
      const app = buildTestApp(db.pool, { logger: { level: "info", stream: logs.stream } });
      const ania = await createUser(app);
      const tomek = await createUser(app);
      const list = await createList(db.pool, ania);
      const link = await createInvitation(db.pool, list);
      const ip = randomIp();
      const { max } = RATE_LIMITS.invitationLookupPerIp;

      for (let attempt = 0; attempt <= max; attempt += 1) {
        await app.inject({
          method,
          url: `/api/v1/invitations/${link.token}${suffix}`,
          headers: { origin: TEST_ORIGIN, cookie: tomek.cookie },
          remoteAddress: ip,
        });
      }

      const limited = logs.security().filter((entry) => entry["event"] === "rate_limited");
      expect(limited).toEqual([expect.objectContaining({ route })]);
      expect(logs.lines.join("\n")).not.toContain(link.token);
      expect(JSON.stringify(limited)).not.toContain(ip);
      await app.close();
    },
  );
});
