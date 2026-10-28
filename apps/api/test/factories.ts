import { randomInt, randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { INVITATION_VALIDITY_DAYS, normalizeItemName } from "@lista/shared";
import { invitation, item, listMember, shoppingList } from "../src/db/schema";
import { invitationToken } from "../src/modules/zaproszenia/domain/token";
import { cryptoRandomBytes } from "../src/modules/zaproszenia/infra/random";
import { TEST_ORIGIN } from "./app";
import { cookieHeader } from "./cookies";

export interface TestUser {
  id: string;
  name: string;
  email: string;
  password: string;
  /** `nazwa=wartość` ciasteczka sesji z rejestracji. */
  cookie: string;
}

/** Losowy adres IP: fabryki nie wyczerpują limitów per IP testów, które je sprawdzają. */
export function randomIp(): string {
  return `10.${String(randomInt(256))}.${String(randomInt(256))}.${String(randomInt(1, 255))}`;
}

/** Konto założone przez API (jak w produkcji), od razu z sesją. */
export async function createUser(
  app: FastifyInstance,
  overrides: Partial<Pick<TestUser, "name" | "email" | "password">> = {},
): Promise<TestUser> {
  const account = {
    name: "Domownik",
    email: `user-${randomUUID()}@example.com`,
    password: `haslo-${randomUUID()}`,
    ...overrides,
  };
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/sign-up/email",
    headers: { origin: TEST_ORIGIN },
    remoteAddress: randomIp(),
    payload: { ...account, termsAccepted: true, ageConfirmed: true },
  });
  if (response.statusCode !== 200) throw new Error(`sign-up failed: ${response.body}`);
  const { user } = response.json<{ user: { id: string } }>();
  return { ...account, id: user.id, cookie: cookieHeader(response.headers["set-cookie"]) };
}

/** Nowa sesja istniejącego konta; zwraca `nazwa=wartość` ciasteczka. */
export async function signIn(app: FastifyInstance, user: Pick<TestUser, "email" | "password">) {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/sign-in/email",
    headers: { origin: TEST_ORIGIN },
    remoteAddress: randomIp(),
    payload: { email: user.email, password: user.password },
  });
  if (response.statusCode !== 200) throw new Error(`sign-in failed: ${response.body}`);
  return cookieHeader(response.headers["set-cookie"]);
}

export interface TestList {
  id: string;
  name: string;
  ownerId: string;
}

/** Lista właściciela wprost w bazie (szybko, także dziesiątki list do testów limitu). */
export async function createList(
  pool: Pool,
  owner: Pick<TestUser, "id">,
  name = `Lista ${randomUUID().slice(0, 8)}`,
): Promise<TestList> {
  const [list] = await drizzle(pool)
    .insert(shoppingList)
    .values({ ownerId: owner.id, name })
    .returning({ id: shoppingList.id });
  if (!list) throw new Error("createList: no row");
  return { id: list.id, name, ownerId: owner.id };
}

/** Uczestnictwo wprost w bazie, do czasu przyjmowania zaproszeń (T-008). */
export async function addMember(
  pool: Pool,
  list: Pick<TestList, "id">,
  user: Pick<TestUser, "id">,
): Promise<void> {
  await drizzle(pool).insert(listMember).values({ listId: list.id, userId: user.id });
}

export interface TestItem {
  id: string;
  name: string;
}

/** Pozycja wprost w bazie (np. 500 pozycji do testu limitu); `by: null` = autor usunięty. */
export async function createItem(
  pool: Pool,
  list: Pick<TestList, "id">,
  by: Pick<TestUser, "id"> | null,
  name = `Pozycja ${randomUUID().slice(0, 8)}`,
): Promise<TestItem> {
  const [row] = await drizzle(pool)
    .insert(item)
    .values({ listId: list.id, name, nameKey: normalizeItemName(name), addedBy: by?.id ?? null })
    .returning({ id: item.id });
  if (!row) throw new Error("createItem: no row");
  return { id: row.id, name };
}

export interface TestInvitation {
  id: string;
  token: string;
}

/** Aktywny link zaproszenia wprost w bazie; `createdAt` domyślnie teraz, ważny 7 dni. */
export async function createInvitation(
  pool: Pool,
  list: Pick<TestList, "id">,
  createdAt = new Date(),
): Promise<TestInvitation> {
  const token = invitationToken(cryptoRandomBytes);
  const expiresAt = new Date(createdAt.getTime() + INVITATION_VALIDITY_DAYS * 86_400_000);
  const [row] = await drizzle(pool)
    .insert(invitation)
    .values({ listId: list.id, token, createdAt, expiresAt })
    .returning({ id: invitation.id });
  if (!row) throw new Error("createInvitation: no row");
  return { id: row.id, token };
}
