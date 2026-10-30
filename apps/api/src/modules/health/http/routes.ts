import { RATE_LIMITS, type HealthReadyResponse } from "@lista/shared";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { perIp, perIpRateLimit } from "../../../http/rate-limit";

export function healthRoutes(app: FastifyInstance, pool: Pool): void {
  // Bez bazy i bez limitu: zewnętrzne healthchecki nie mogą budzić Neona (deployment.md, ryzyka).
  app.get("/health", () => ({ status: "ok" }));

  // Limit tylko w tym zakresie; jedna instancja API, więc licznik w pamięci wystarcza (ADR 0003).
  void app.register(async (scope) => {
    await perIpRateLimit(scope);

    scope.get("/health/ready", perIp(RATE_LIMITS.healthReadyPerIp), async (request, reply) => {
      try {
        await pool.query("SELECT 1");
        return { status: "ok", database: "up" } satisfies HealthReadyResponse;
      } catch (error) {
        request.log.warn({ err: error }, "database unreachable");
        return reply
          .code(503)
          .send({ status: "unavailable", database: "down" } satisfies HealthReadyResponse);
      }
    });
  });
}
