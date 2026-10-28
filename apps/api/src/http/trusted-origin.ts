import type { FastifyInstance } from "fastify";
import { ApiError } from "./api-error";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * TH-14: żądanie zmieniające stan w `/api/v1/*` tylko z originu aplikacji (CSRF). Trasy
 * `/api/auth/*` sprawdza Better Auth.
 */
export function trustedOrigin(app: FastifyInstance, origin: string): void {
  app.addHook("onRequest", (request, _reply, done) => {
    const changesState = !SAFE_METHODS.has(request.method) && request.url.startsWith("/api/v1/");
    done(
      changesState && request.headers.origin !== origin
        ? new ApiError(403, "invalid_origin")
        : undefined,
    );
  });
}
