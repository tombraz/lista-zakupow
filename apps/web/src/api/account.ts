import type { Me, SignInRequest, SignUpRequest } from "@lista/shared";
import { apiRequest, ApiRequestError } from "./client";

export async function signUp(account: SignUpRequest): Promise<Me> {
  const { user } = await apiRequest<{ user: Me }>("/api/auth/sign-up/email", account);
  return user;
}

export async function signIn(credentials: SignInRequest): Promise<Me> {
  const { user } = await apiRequest<{ user: Me }>("/api/auth/sign-in/email", credentials);
  return user;
}

export async function signOut(): Promise<void> {
  await apiRequest("/api/auth/sign-out", {});
}

/** Zalogowany domownik albo `null` dla anonima. */
export async function fetchMe(): Promise<Me | null> {
  try {
    return await apiRequest<Me>("/api/v1/me");
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401) return null;
    throw error;
  }
}
