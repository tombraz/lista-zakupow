import type { FastifyReply } from "fastify";

/** Ciasteczka ustawione przez Better Auth trafiają do odpowiedzi Fastify bez zmian. */
export function passCookies(headers: Headers, reply: FastifyReply): void {
  for (const cookie of headers.getSetCookie()) void reply.header("set-cookie", cookie);
}
