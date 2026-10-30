import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import type { FastifyInstance } from "fastify";
import { BUSINESS_LIMITS, LIVE_LIMITS, RATE_LIMITS } from "@lista/shared";
import { describe, expect, it } from "vitest";
import { user } from "../src/db/schema";
import { buildTestApp, TEST_ORIGIN } from "./app";
import { useTestDatabase } from "./database";
import { addMember, createInvitation, createList, createUser, randomIp } from "./factories";
import { connectLive, liveUrl, type LiveClient } from "./live";
import { captureLogs } from "./logs";
import { requestsAs } from "./requests";

type LimitKey = keyof typeof RATE_LIMITS | keyof typeof BUSINESS_LIMITS | keyof typeof LIVE_LIMITS;

/** Progi, które nie są limitem nadużyć: ich przekroczenie nie jest zdarzeniem bezpieczeństwa. */
const NOT_ABUSE_LIMITS = {
  pingIntervalSeconds: "co ile serwer wysyła ping (bicie serca), nie ogranicza klienta",
  pongTimeoutSeconds: "zerwane połączenie (brak pong), nie nadużycie",
} satisfies Partial<Record<LimitKey, string>>;

type AbuseLimit = Exclude<LimitKey, keyof typeof NOT_ABUSE_LIMITS>;

interface Context {
  app: FastifyInstance;
  live: (cookie: string) => Promise<LiveClient>;
}

/** Przekracza limit dokładnie raz; zwraca pola oczekiwanego zdarzenia w logu `security`. */
type Scenario = (ctx: Context) => Promise<Record<string, unknown>>;

const SIGN_IN = "/api/auth/sign-in/email";
const SIGN_UP = "/api/auth/sign-up/email";

function signIn(app: FastifyInstance, email: string, remoteAddress: string) {
  return app.inject({
    method: "POST",
    url: SIGN_IN,
    headers: { origin: TEST_ORIGIN },
    remoteAddress,
    payload: { email, password: "zle-haslo-1" },
  });
}

async function repeat(times: number, send: () => Promise<unknown>) {
  for (let attempt = 0; attempt < times; attempt += 1) await send();
}

// T-034 (TH-21, architecture.md „Obserwowalność”): każdy limit nadużyć ma tu scenariusz.
// Nowy klucz w `RATE_LIMITS`, `BUSINESS_LIMITS` lub `LIVE_LIMITS` bez scenariusza → test czerwony.
describe("every abuse limit leaves a security event (TH-21)", () => {
  const db = useTestDatabase();

  const SCENARIOS: Record<AbuseLimit, Scenario> = {
    signInPerIp: async ({ app }) => {
      const ip = randomIp();
      await repeat(RATE_LIMITS.signInPerIp.max + 1, () =>
        signIn(app, `nikt-${randomUUID()}@example.com`, ip),
      );
      return { event: "rate_limited", route: SIGN_IN };
    },
    signInFailuresPerAccount: async ({ app }) => {
      const { email } = await createUser(app);
      await repeat(RATE_LIMITS.signInFailuresPerAccount.max + 1, () =>
        signIn(app, email, randomIp()),
      );
      return { event: "rate_limited", route: SIGN_IN, accountKey: expect.any(String) };
    },
    signUpPerIp: async ({ app }) => {
      const ip = randomIp();
      await repeat(RATE_LIMITS.signUpPerIp.max + 1, () =>
        app.inject({
          method: "POST",
          url: SIGN_UP,
          headers: { origin: TEST_ORIGIN },
          remoteAddress: ip,
          payload: {
            name: "Domownik",
            email: `user-${randomUUID()}@example.com`,
            password: "dobre-haslo-1",
            termsAccepted: true,
            ageConfirmed: true,
          },
        }),
      );
      return { event: "rate_limited", route: SIGN_UP };
    },
    healthReadyPerIp: async ({ app }) => {
      const ip = randomIp();
      await repeat(RATE_LIMITS.healthReadyPerIp.max + 1, () =>
        app.inject({ method: "GET", url: "/health/ready", remoteAddress: ip }),
      );
      return { event: "rate_limited", route: "/health/ready" };
    },
    invitationLookupPerIp: async ({ app }) => {
      const tomek = await createUser(app);
      const ip = randomIp();
      await repeat(RATE_LIMITS.invitationLookupPerIp.max + 1, () =>
        app.inject({
          method: "GET",
          url: `/api/v1/invitations/${"A".repeat(43)}`,
          headers: { origin: TEST_ORIGIN, cookie: tomek.cookie },
          remoteAddress: ip,
        }),
      );
      return { event: "rate_limited", route: "/api/v1/invitations/:token" };
    },
    invitationsCreatedPerList: async ({ app }) => {
      const ania = await createUser(app);
      const list = await createList(db.pool, ania);
      await repeat(RATE_LIMITS.invitationsCreatedPerList.max, () =>
        createInvitation(db.pool, list),
      );
      await requestsAs(app, ania)("POST", `/api/v1/lists/${list.id}/invitations`);
      return {
        event: "rate_limited",
        route: "/api/v1/lists/:listId/invitations",
        listId: list.id,
      };
    },
    listsPerOwner: async ({ app }) => {
      const ania = await createUser(app);
      await repeat(BUSINESS_LIMITS.listsPerOwner, () => createList(db.pool, ania));
      await requestsAs(app, ania)("POST", "/api/v1/lists", { name: "Za dużo" });
      return { event: "limit_reached", route: "/api/v1/lists", limit: "lists", userId: ania.id };
    },
    itemsPerList: async ({ app }) => {
      const ania = await createUser(app);
      const list = await createList(db.pool, ania);
      await db.pool.query(
        `INSERT INTO item (id, list_id, name, name_key, added_by)
         SELECT gen_random_uuid(), $1, 'Pozycja ' || n, 'pozycja ' || n, $2
         FROM generate_series(1, $3::int) AS n`,
        [list.id, ania.id, BUSINESS_LIMITS.itemsPerList],
      );
      await requestsAs(app, ania)("POST", `/api/v1/lists/${list.id}/items`, { name: "Za dużo" });
      return {
        event: "limit_reached",
        route: "/api/v1/lists/:listId/items",
        limit: "items",
        userId: ania.id,
        listId: list.id,
      };
    },
    participantsPerList: async ({ app }) => {
      const ania = await createUser(app);
      const list = await createList(db.pool, ania);
      const people = Array.from({ length: BUSINESS_LIMITS.participantsPerList }, () => {
        const id = randomUUID();
        return { id, name: "Uczestnik", email: `${id}@example.com` };
      });
      await drizzle(db.pool).insert(user).values(people);
      for (const person of people) await addMember(db.pool, list, person);
      await requestsAs(app, ania)("POST", `/api/v1/lists/${list.id}/invitations`);
      return {
        event: "limit_reached",
        route: "/api/v1/lists/:listId/invitations",
        limit: "participants",
        userId: ania.id,
        listId: list.id,
      };
    },
    connectionsPerSession: async ({ app, live }) => {
      const ania = await createUser(app);
      await repeat(LIVE_LIMITS.connectionsPerSession, () => live(ania.cookie));
      await (await live(ania.cookie)).closed();
      return { event: "limit_reached", limit: "connectionsPerSession", userId: ania.id };
    },
    messagesPerSecond: async ({ app, live }) => {
      const ania = await createUser(app);
      const client = await live(ania.cookie);
      for (let i = 0; i <= LIVE_LIMITS.messagesPerSecond; i += 1) client.send({ type: "pong" });
      await client.closed();
      return { event: "rate_limited", limit: "messagesPerSecond", userId: ania.id };
    },
    messageBytes: async ({ app, live }) => {
      const ania = await createUser(app);
      const client = await live(ania.cookie);
      client.send({ type: "subscribe", listId: "x".repeat(LIVE_LIMITS.messageBytes) });
      await client.closed();
      return { event: "limit_reached", limit: "messageBytes", userId: ania.id };
    },
  };

  const ALL_LIMITS = [
    ...Object.keys(RATE_LIMITS),
    ...Object.keys(BUSINESS_LIMITS),
    ...Object.keys(LIVE_LIMITS),
  ];
  const ABUSE_LIMITS = ALL_LIMITS.filter((key) => !(key in NOT_ABUSE_LIMITS));

  it("every abuse limit has a security-log scenario", () => {
    expect(ABUSE_LIMITS.filter((key) => !(key in SCENARIOS))).toEqual([]);
    expect(Object.keys(NOT_ABUSE_LIMITS).filter((key) => !ALL_LIMITS.includes(key))).toEqual([]);
  });

  it.each(ABUSE_LIMITS)("%s: exceeding the limit logs one security event", async (key) => {
    const scenario = (SCENARIOS as Partial<Record<string, Scenario>>)[key];
    if (!scenario) throw new Error(`no security-log scenario for limit ${key}`);
    const logs = captureLogs();
    const app = buildTestApp(db.pool, { logger: { level: "info", stream: logs.stream } });
    const clients: LiveClient[] = [];
    let url: Promise<string> | undefined;
    const live = async (cookie: string) => {
      url ??= liveUrl(app);
      const client = await connectLive(await url, { cookie });
      clients.push(client);
      return client;
    };

    try {
      const expected = await scenario({ app, live });

      const events = logs
        .security()
        .filter((entry) => entry["event"] === "limit_reached" || entry["event"] === "rate_limited");
      expect(events).toEqual([expect.objectContaining(expected)]);
      expect(events[0]?.["requestId"]).toEqual(expect.any(String));
    } finally {
      for (const client of clients) client.close();
      await app.close();
    }
  });
});
