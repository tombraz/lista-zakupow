import rateLimit from "@fastify/rate-limit";
import { RATE_LIMITS } from "@lista/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { logLimitEvent } from "../logging";
import { ApiError } from "./api-error";

/**
 * Limit per IP dla tras w zakresie `scope` (licznik w pamięci, jedna instancja API — ADR 0003).
 * Jedyne miejsce rejestracji `@fastify/rate-limit` (eslint); limit trasy tylko przez `perIp`.
 */
export async function perIpRateLimit(scope: FastifyInstance): Promise<void> {
  await scope.register(rateLimit, { global: false });
}

/**
 * Opcje trasy z limitem `RATE_LIMITS[key]`; trasa musi być w zakresie z `perIpRateLimit`.
 * Przekroczenie zawsze zostawia zdarzenie `rate_limited` z kluczem limitu w logu `security`,
 * bez adresu IP (TH-21, T-027, T-035).
 */
export function perIp(key: keyof typeof RATE_LIMITS) {
  const { windowSeconds, max } = RATE_LIMITS[key];
  const errorResponseBuilder = (request: FastifyRequest) => {
    logLimitEvent(request, "rate_limited", key);
    return new ApiError(429, "rate_limited");
  };
  return { config: { rateLimit: { max, timeWindow: windowSeconds * 1000, errorResponseBuilder } } };
}
