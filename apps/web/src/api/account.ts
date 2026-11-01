import type {
  Me,
  PasswordResetRequest,
  SignInRequest,
  SignUpRequest,
  SignUpResponse,
} from "@lista/shared";
import { apiRequest, ApiRequestError } from "./client";

/** Z `invitationToken` odpowiedź mówi też, czy rejestracja dołączyła do listy (F-12). */
export function signUp(account: SignUpRequest): Promise<SignUpResponse> {
  return apiRequest<SignUpResponse>("/api/auth/sign-up/email", { body: account });
}

export async function signIn(credentials: SignInRequest): Promise<Me> {
  const { user } = await apiRequest<{ user: Me }>("/api/auth/sign-in/email", {
    body: credentials,
  });
  return user;
}

/** F-03: zawsze 200, także dla nieistniejącego konta (TH-11); 429 przy limicie. */
export async function requestPasswordReset(request: PasswordResetRequest): Promise<void> {
  await apiRequest("/api/auth/request-password-reset", { body: request });
}

export async function signOut(): Promise<void> {
  await apiRequest("/api/auth/sign-out", { body: {} });
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
