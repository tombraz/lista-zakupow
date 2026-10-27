import rateLimit from "@fastify/rate-limit";
import { RATE_LIMITS, type HealthReadyResponse } from "@lista/shared";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { ApiError } from "../../../http/api-error";

const { windowSeconds, max } = RATE_LIMITS.healthReadyPerIp;

export function healthRoutes(app: FastifyInstance, pool: Pool): void {
  // Bez bazy i bez limitu: zewnętrzne healthchecki nie mogą budzić Neona (deployment.md, ryzyka).
  app.get("/health", () => ({ status: "ok" }));

  // Limit tylko w tym zakresie; jedna instancja API, więc licznik w pamięci wystarcza (ADR 0003).
  void app.register(async (scope) => {
    await scope.register(rateLimit, {
      global: false,
      errorResponseBuilder: () => new ApiError(429, "rate_limited"),
    });

    scope.get(
      "/health/ready",
      { config: { rateLimit: { max, timeWindow: windowSeconds * 1000 } } },
      async (request, reply) => {
        try {
          await pool.query("SELECT 1");
          return { status: "ok", database: "up" } satisfies HealthReadyResponse;
        } catch (error) {
          request.log.warn({ err: error }, "database unreachable");
          return reply
            .code(503)
            .send({ status: "unavailable", database: "down" } satisfies HealthReadyResponse);
        }
      },
    );
  });
}
