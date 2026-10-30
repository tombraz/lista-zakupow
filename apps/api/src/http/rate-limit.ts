import rateLimit from "@fastify/rate-limit";
import type { RateLimit } from "@lista/shared";
import type { FastifyInstance } from "fastify";
import { securityLog } from "../logging";
import { ApiError } from "./api-error";

/**
 * Limit per IP dla tras w zakresie `scope` (licznik w pamięci, jedna instancja API — ADR 0003).
 * Jedyne miejsce rejestracji `@fastify/rate-limit` (eslint): przekroczenie zawsze zostawia
 * zdarzenie `rate_limited` w logu `security`, z trasą i bez adresu IP (TH-21, T-027).
 */
export async function perIpRateLimit(scope: FastifyInstance): Promise<void> {
  await scope.register(rateLimit, {
    global: false,
    errorResponseBuilder: (request) => {
      const route = request.routeOptions.url;
      securityLog(request.log).warn({ event: "rate_limited", route }, "rate_limited");
      return new ApiError(429, "rate_limited");
    },
  });
}

/** Opcje trasy z limitem z `RATE_LIMITS`; trasa musi być w zakresie z `perIpRateLimit`. */
export function perIp({ windowSeconds, max }: RateLimit) {
  return { config: { rateLimit: { max, timeWindow: windowSeconds * 1000 } } };
}
