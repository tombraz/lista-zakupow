import { fromNodeHeaders } from "better-auth/node";
import type { FastifyReply, FastifyRequest } from "fastify";
import { ApiError } from "../../../http/api-error";
import { passCookies } from "./cookies";
import type { Auth } from "../infra/auth";

/**
 * Sesja z ciasteczka (zalogowany domownik i identyfikator sesji) albo 401 `unauthenticated`.
 * Przekazuje odnowione ciasteczko sesji, żeby przedłużenie przy użyciu działało też
 * w przeglądarce (ADR 0002, TH-17).
 */
export async function requireSession(auth: Auth, request: FastifyRequest, reply: FastifyReply) {
  const { headers, response: session } = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
    returnHeaders: true,
  });
  if (!session) throw new ApiError(401, "unauthenticated");
  passCookies(headers, reply);
  return { user: session.user, sessionId: session.session.id };
}

/** Zalogowany domownik albo 401 `unauthenticated` (trasy `/api/v1/*`). */
export async function requireUser(auth: Auth, request: FastifyRequest, reply: FastifyReply) {
  return (await requireSession(auth, request, reply)).user;
}
