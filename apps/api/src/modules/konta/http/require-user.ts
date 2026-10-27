import { fromNodeHeaders } from "better-auth/node";
import type { FastifyRequest } from "fastify";
import { ApiError } from "../../../http/api-error";
import type { Auth } from "../infra/auth";

/** Zalogowany domownik albo 401 `unauthenticated` (trasy `/api/v1/*`). */
export async function requireUser(auth: Auth, request: FastifyRequest) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
  if (!session) throw new ApiError(401, "unauthenticated");
  return session.user;
}
