import { randomUUID } from "node:crypto";
import type { ErrorCode } from "@lista/shared";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp, TEST_ORIGIN } from "./app";
import { useTestDatabase } from "./database";
import {
  addMember,
  createInvitation,
  createItem,
  createList,
  createUser,
  randomIp,
  type TestInvitation,
  type TestItem,
  type TestList,
  type TestUser,
} from "./factories";
import { captureLogs } from "./logs";
import { capturingMailer } from "./mailer";
import { requestResetToken } from "./reset-token";

/**
 * T-070 (TH-20): NUL w danych z żądania doszedł do bazy i dał 500 trzy razy (QA T-005, T-026,
 * QA T-058), za każdym razem na innej trasie. Ten test zna wszystkie trasy `/api/*`: nowa trasa
 * bez wpisu w `EXAMPLES` albo `EXCLUDED` zawodzi inwentarz, a każda trasa z wpisem dostaje NUL
 * w każdym parametrze ścieżki i każdym polu tekstowym treści.
 */

type Method = "GET" | "POST" | "PATCH" | "DELETE";

interface Context {
  owner: TestUser;
  member: TestUser;
  list: TestList;
  item: TestItem;
  invitation: TestInvitation;
  resetToken: string;
}

interface Example {
  /** Poprawne wartości parametrów ścieżki, które dochodzą do domeny jako właściciel listy. */
  params?: (context: Context) => Record<string, string>;
  /** Poprawna treść; wołana przy każdym żądaniu (np. nowy e-mail rejestracji). */
  body?: (context: Context) => Record<string, unknown>;
  /** Status poprawnego żądania: wpis w tabeli naprawdę dochodzi do handlera. */
  ok: number;
  /**
   * Pola, w których NUL jest poprawną treścią, bo nie trafia do bazy jako tekst. Dla nich
   * oczekiwane jest „nigdy 500”, nie 4xx. Powód obowiązkowy.
   */
  nulAccepted?: Record<string, string>;
}

const json = { "content-type": "application/json" };

/** Każda trasa `/api/*` z wejściem od klienta: przykładowe żądanie jako właściciel listy. */
const EXAMPLES: Record<string, Example> = {
  "POST /api/auth/sign-up/email": {
    body: () => ({
      name: "Domownik",
      email: `nul-${randomUUID()}@example.com`,
      password: `haslo-${randomUUID()}`,
      termsAccepted: true,
      ageConfirmed: true,
      invitationToken: "Kq3vZ8pLw2XnR5tY7uB1cD4eF6gH9jM0oN-sA_iE3rT",
    }),
    ok: 200,
    nulAccepted: {
      password: "hasło trafia do bazy tylko jako skrót (Better Auth)",
      invitationToken: "zły token nie blokuje rejestracji (api.md, F-12): 200 z invitation_invalid",
    },
  },
  "POST /api/auth/sign-in/email": {
    body: ({ owner }) => ({ email: owner.email, password: owner.password }),
    ok: 200,
    nulAccepted: {
      // HMAC dopełnia klucz zerami do bloku, więc „hasło” i „hasło\0” mają ten sam skrót scrypt.
      password: "porównywane ze skrótem, nie trafia do bazy; poprawne hasło + NUL na końcu = 200",
    },
  },
  "POST /api/auth/request-password-reset": {
    body: ({ owner }) => ({ email: owner.email }),
    ok: 200,
  },
  "POST /api/auth/reset-password": {
    body: ({ resetToken }) => ({ token: resetToken, newPassword: `nowe-${randomUUID()}` }),
    ok: 200,
    nulAccepted: { newPassword: "hasło trafia do bazy tylko jako skrót (Better Auth)" },
  },
  "PATCH /api/v1/me": { body: () => ({ name: "Nowe imię" }), ok: 200 },
  "DELETE /api/v1/me": { body: () => ({ confirm: true }), ok: 204 },
  "POST /api/v1/lists": { body: () => ({ name: "Zakupy" }), ok: 201 },
  "GET /api/v1/lists/:listId": { params: ({ list }) => ({ listId: list.id }), ok: 200 },
  "PATCH /api/v1/lists/:listId": {
    params: ({ list }) => ({ listId: list.id }),
    body: () => ({ name: "Nowa nazwa" }),
    ok: 200,
  },
  "DELETE /api/v1/lists/:listId": { params: ({ list }) => ({ listId: list.id }), ok: 204 },
  "GET /api/v1/lists/:listId/members": { params: ({ list }) => ({ listId: list.id }), ok: 200 },
  "DELETE /api/v1/lists/:listId/members/:userId": {
    params: ({ list, member }) => ({ listId: list.id, userId: member.id }),
    ok: 204,
  },
  // Właściciel nie może opuścić własnej listy: 403 to odpowiedź z domeny, za walidacją.
  "POST /api/v1/lists/:listId/leave": { params: ({ list }) => ({ listId: list.id }), ok: 403 },
  "POST /api/v1/lists/:listId/items": {
    params: ({ list }) => ({ listId: list.id }),
    body: () => ({ id: randomUUID(), name: "Mleko", note: "2 litry" }),
    ok: 201,
  },
  "POST /api/v1/lists/:listId/items/clear-checked": {
    params: ({ list }) => ({ listId: list.id }),
    ok: 200,
  },
  "PATCH /api/v1/lists/:listId/items/:itemId": {
    params: ({ list, item }) => ({ listId: list.id, itemId: item.id }),
    body: () => ({ name: "Chleb", note: "razowy", checked: true }),
    ok: 200,
  },
  "DELETE /api/v1/lists/:listId/items/:itemId": {
    params: ({ list, item }) => ({ listId: list.id, itemId: item.id }),
    ok: 204,
  },
  "GET /api/v1/lists/:listId/invitations": {
    params: ({ list }) => ({ listId: list.id }),
    ok: 200,
  },
  "POST /api/v1/lists/:listId/invitations": {
    params: ({ list }) => ({ listId: list.id }),
    ok: 201,
  },
  "DELETE /api/v1/lists/:listId/invitations/:invitationId": {
    params: ({ list, invitation }) => ({ listId: list.id, invitationId: invitation.id }),
    ok: 204,
  },
  "GET /api/v1/invitations/:token": {
    params: ({ invitation }) => ({ token: invitation.token }),
    ok: 200,
  },
  // Właściciel z linkiem do własnej listy: 409 `own_list` z domeny, za walidacją.
  "POST /api/v1/invitations/:token/accept": {
    params: ({ invitation }) => ({ token: invitation.token }),
    ok: 409,
  },
};

/** Trasy `/api/*` poza tabelą, z powodem. Nigdy „bo dawało 500” (AC6). */
const EXCLUDED: Record<string, string> = {
  "POST /api/auth/sign-out":
    "bez wejścia: ani parametrów, ani treści (ciasteczko czyta Better Auth)",
  "GET /api/v1/me": "bez wejścia: tylko ciasteczko sesji",
  "GET /api/v1/lists": "bez wejścia: tylko ciasteczko sesji",
  "GET /api/v1/live":
    "WebSocket: wejście to wiadomości klienta, sprawdzane osobno (parseClientMessage, test niżej)",
};

/**
 * Każda trasa zarejestrowana w aplikacji jako `METODA ścieżka`, z drzewa `printRoutes` (węzeł
 * z metodami to trasa, poziom co 4 znaki wcięcia). `HEAD` dodaje Fastify do każdego `GET`.
 * Bez `vi.mock("fastify")` i bez `onRoute` po `buildApp`: trasy na głównej instancji są już
 * zarejestrowane, zanim test mógłby dodać hook (layers/backend.md, „Pułapki”: `isolate: false`).
 */
function registeredRoutes(app: FastifyInstance): string[] {
  const parents: string[] = [];
  const routes: string[] = [];
  for (const line of app.printRoutes({ commonPrefix: false }).split("\n")) {
    const node = /^([│ ]*)[├└]── (\S+)(?: \(([^)]*)\))?$/.exec(line);
    if (!node) continue;
    parents.length = (node[1] ?? "").length / 4;
    parents.push(node[2] ?? "");
    for (const method of node[3]?.split(", ") ?? []) {
      if (method !== "HEAD") routes.push(`${method} ${parents.join("")}`);
    }
  }
  return routes;
}

const ERROR_CODES = Object.keys({
  not_found: true,
  owner_only: true,
  owner_cannot_leave: true,
  limit_reached: true,
  duplicate_item: true,
  own_list: true,
  already_member: true,
  invitation_invalid: true,
  rate_limited: true,
  validation_failed: true,
  unauthenticated: true,
  invalid_credentials: true,
  invalid_origin: true,
  email_taken: true,
  invalid_token: true,
  internal: true,
} satisfies Record<ErrorCode, true>);

// Ślady błędu bazy, które nie mogą dojść do klienta (SEC1, layers/backend.md „Pułapki”).
const DATABASE_LEAK = /select|insert|delete from|byte sequence|0x00|22021|drizzle|postgres/i;

/** Wartości parametru ścieżki z NUL: sam, doklejony z każdej strony, w środku, podwójnie zakodowany. */
function nulParams(valid: string): string[] {
  const middle = Math.floor(valid.length / 2);
  return [
    "%00",
    `%00${valid}`,
    `${valid}%00`,
    `${valid.slice(0, middle)}%00${valid.slice(middle)}`,
    "%2500",
    `${valid}%2500`,
  ];
}

/** Każde pole tekstowe treści (także zagnieżdżone) jako ścieżka kluczy. */
function textFields(value: unknown, path: string[] = []): string[][] {
  if (typeof value === "string") return [path];
  if (Array.isArray(value))
    return value.flatMap((entry, index) => textFields(entry, [...path, String(index)]));
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([key, entry]) => textFields(entry, [...path, key]));
  }
  return [];
}

function withText(body: unknown, path: string[], change: (text: string) => string): unknown {
  const [key, ...rest] = path;
  if (key === undefined) return change(body as string);
  if (Array.isArray(body)) {
    return (body as unknown[]).map((entry, index) =>
      String(index) === key ? withText(entry, rest, change) : entry,
    );
  }
  const object = body as Record<string, unknown>;
  return { ...object, [key]: withText(object[key], rest, change) };
}

function nulTexts(valid: string): string[] {
  return [
    "\u0000",
    `\u0000${valid}`,
    `${valid}\u0000`,
    `${valid.slice(0, 1)}\u0000${valid.slice(1)}`,
  ];
}

const urlOf = (pattern: string, params: Record<string, string>) =>
  pattern.replace(/:(\w+)/g, (_match, name: string) => params[name] ?? `:${name}`);

describe("NUL on every /api route (T-070, TH-20)", () => {
  const db = useTestDatabase();
  const logs = captureLogs();
  const { mailer, sent } = capturingMailer();
  let app: FastifyInstance;
  let stranger: TestUser;

  beforeAll(async () => {
    app = buildTestApp(db.pool, { mailer, logger: { level: "info", stream: logs.stream } });
    await app.ready();
    stranger = await createUser(app);
  });

  afterAll(async () => {
    await app.close();
  });

  /** Świeży właściciel z listą, uczestnikiem, pozycją, linkiem i tokenem resetu. */
  async function freshContext(): Promise<Context> {
    const owner = await createUser(app);
    const member = await createUser(app);
    const list = await createList(db.pool, owner);
    await addMember(db.pool, list, member);
    const item = await createItem(db.pool, list, owner);
    const invitation = await createInvitation(db.pool, list);
    const resetToken = await requestResetToken(app, owner, sent);
    return { owner, member, list, item, invitation, resetToken };
  }

  function send(method: Method, url: string, cookie: string | null, payload?: unknown) {
    return app.inject({
      method,
      url,
      remoteAddress: randomIp(),
      headers: {
        origin: TEST_ORIGIN,
        ...(cookie ? { cookie } : {}),
        ...(payload === undefined ? {} : json),
      },
      ...(payload === undefined ? {} : { payload: JSON.stringify(payload) }),
    });
  }

  it("has an example request or a stated exclusion for every /api route (AC1, AC2)", () => {
    const routes = registeredRoutes(app).filter((route) =>
      route.split(" ")[1]?.startsWith("/api/"),
    );
    expect(routes).toContain("DELETE /api/v1/lists/:listId/members/:userId");
    const known = [...Object.keys(EXAMPLES), ...Object.keys(EXCLUDED)];
    expect({ missingInTable: routes.filter((route) => !known.includes(route)) }).toEqual({
      missingInTable: [],
    });
    expect({ notRegistered: known.filter((route) => !routes.includes(route)) }).toEqual({
      notRegistered: [],
    });
  });

  for (const [route, example] of Object.entries(EXAMPLES)) {
    const [method, pattern] = route.split(" ") as [Method, string];

    it(`${route}: NUL in every path parameter and text field is 4xx, never 500 (AC3, AC4, SEC1)`, async () => {
      const context = await freshContext();
      const params = example.params?.(context) ?? {};
      const body = () => example.body?.(context);
      const callers: [string, string | null][] = [
        ["owner", context.owner.cookie],
        ["stranger", stranger.cookie],
        ["anonymous", null],
      ];
      const answers: {
        caller: string;
        case: string;
        status: number;
        body: string;
        nulAccepted?: boolean;
      }[] = [];

      for (const [caller, cookie] of callers) {
        for (const name of Object.keys(params)) {
          for (const value of nulParams(params[name] ?? "")) {
            const response = await send(
              method,
              urlOf(pattern, { ...params, [name]: value }),
              cookie,
              body(),
            );
            answers.push({
              caller,
              case: `:${name}=${value}`,
              status: response.statusCode,
              body: response.body,
            });
          }
        }
        for (const field of textFields(body())) {
          for (const index of nulTexts("x").keys()) {
            const payload = withText(body(), field, (valid) => nulTexts(valid)[index] ?? "");
            const response = await send(method, urlOf(pattern, params), cookie, payload);
            answers.push({
              caller,
              case: `${field.join(".")}#${String(index)}`,
              status: response.statusCode,
              body: response.body,
              nulAccepted: example.nulAccepted?.[field.join(".")] !== undefined,
            });
          }
        }
      }

      const wrong = answers.filter(
        (answer) =>
          answer.status >= 500 ||
          (!answer.nulAccepted && answer.caller === "owner" && answer.status < 400) ||
          DATABASE_LEAK.test(answer.body),
      );
      expect(wrong).toEqual([]);
      // 4xx z kodem błędu z kontraktu (api.md), nie domyślna odpowiedź Fastify.
      const outsideContract = answers.filter((answer) => {
        if (answer.status < 400) return false;
        const code = (JSON.parse(answer.body) as { error?: { code?: string } }).error?.code;
        return !ERROR_CODES.includes(code ?? "");
      });
      expect(outsideContract).toEqual([]);

      // Wpis w tabeli naprawdę dochodzi do handlera: poprawne żądanie właściciela, na świeżych
      // danych (dopuszczony NUL mógł już np. zużyć token resetu).
      const clean = await freshContext();
      const valid = await send(
        method,
        urlOf(pattern, example.params?.(clean) ?? {}),
        clean.owner.cookie,
        example.body?.(clean),
      );
      expect({ route, status: valid.statusCode, body: valid.body }).toMatchObject({
        status: example.ok,
      });
    });
  }

  it("never logs a raw database exception for NUL input (SEC1)", () => {
    const failures = logs.entries().filter((entry) => Number(entry["level"]) >= 50);
    expect(failures).toEqual([]);
    expect(logs.lines.join("\n")).not.toMatch(/byte sequence|22021/);
  });
});
