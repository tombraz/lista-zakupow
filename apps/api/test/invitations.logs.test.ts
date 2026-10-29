import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { createInvitation, createList, createUser } from "./factories";
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
});
