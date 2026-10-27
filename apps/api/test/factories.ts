import { randomInt, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
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
