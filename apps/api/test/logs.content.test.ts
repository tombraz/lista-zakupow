import { randomUUID } from "node:crypto";
import type { Invitation, Item } from "@lista/shared";
import { describe, expect, it } from "vitest";
import { buildTestApp, TEST_ORIGIN } from "./app";
import { cookieHeader } from "./cookies";
import { useTestDatabase } from "./database";
import { createUser, randomIp, signIn } from "./factories";
import { tokenOf } from "./invitations";
import { connectLive, liveUrl } from "./live";
import { captureLogs } from "./logs";
import { requestsAs } from "./requests";

/** Znacznik do wyszukania w logu; krótki, bo imię ma najwyżej 30 znaków. */
function marker(label: string): string {
  return `${label}${randomUUID().slice(0, 8)}`;
}

// T-050 (TH-21): treść list i pozycji oraz dane osób nie trafiają do logu tras `/api/v1` i WS.
describe("content in logs (TH-21)", () => {
  const db = useTestDatabase();

  it("keeps list, item and person content out of logs", async () => {
    const m = {
      ownerName: marker("Wl"),
      ownerEmail: marker("wlasciciel"),
      guestName: marker("Go"),
      guestEmail: marker("gosc"),
      list: marker("Lista"),
      renamed: marker("Nowa"),
      item: marker("Poz"),
      note: marker("Notatka"),
      failure: marker("Awaria"),
    };
    const logs = captureLogs();
    const app = buildTestApp(db.pool, { logger: { level: "info", stream: logs.stream } });
    app.get("/api/v1/test/failing", () => {
      throw new Error(m.failure);
    });
    const auth = (url: string, payload: object) =>
      app.inject({
        method: "POST",
        url,
        headers: { origin: TEST_ORIGIN },
        remoteAddress: randomIp(),
        payload,
      });

    const owner = await createUser(app, {
      name: m.ownerName,
      email: `${m.ownerEmail}@example.com`,
    });
    const asOwner = requestsAs(app, owner);
    expect((await auth("/api/auth/sign-up/email", { ...owner, ...consents() })).statusCode).toBe(
      409,
    );
    expect(
      (await auth("/api/auth/sign-in/email", { email: owner.email, password: "zle-haslo-1" }))
        .statusCode,
    ).toBe(401);
    await signIn(app, owner);

    const list = (await asOwner("POST", "/api/v1/lists", { name: m.list })).json<{ id: string }>();
    const invitation = (
      await asOwner("POST", `/api/v1/lists/${list.id}/invitations`)
    ).json<Invitation>();
    expect(
      (await requestsAs(app, null)("GET", `/api/v1/invitations/${tokenOf(invitation)}`)).statusCode,
    ).toBe(200);
    const guestSignUp = await auth("/api/auth/sign-up/email", {
      name: m.guestName,
      email: `${m.guestEmail}@example.com`,
      password: `haslo-${randomUUID()}`,
      ...consents(),
      invitationToken: tokenOf(invitation),
    });
    expect(guestSignUp.statusCode).toBe(200);
    const guest = { cookie: cookieHeader(guestSignUp.headers["set-cookie"]) };

    const live = await connectLive(await liveUrl(app), guest);
    live.send({ type: "subscribe", listId: list.id });
    await live.next("subscribed");
    const item = (
      await asOwner("POST", `/api/v1/lists/${list.id}/items`, { name: m.item })
    ).json<Item>();
    await asOwner("PATCH", `/api/v1/lists/${list.id}/items/${item.id}`, { note: m.note });
    await asOwner("PATCH", `/api/v1/lists/${list.id}`, { name: m.renamed });
    await live.next("item.upserted");
    await live.next("list.updated");
    live.close();

    const asGuest = requestsAs(app, guest);
    for (const url of ["/api/v1/me", "/api/v1/lists", `/api/v1/lists/${list.id}`])
      expect((await asGuest("GET", url)).statusCode).toBe(200);
    const tooLong = `${m.item}${"x".repeat(200)}`;
    expect(
      (await asGuest("POST", `/api/v1/lists/${list.id}/items`, { name: tooLong })).statusCode,
    ).toBe(400);
    expect((await asGuest("GET", "/api/v1/test/failing")).statusCode).toBe(500);

    expect(logs.lines.length).toBeGreaterThan(0);
    const all = logs.lines.join("\n").toLowerCase();
    for (const value of Object.values(m)) expect(all).not.toContain(value.toLowerCase());
    await app.close();
  });
});

function consents() {
  return { termsAccepted: true, ageConfirmed: true };
}
