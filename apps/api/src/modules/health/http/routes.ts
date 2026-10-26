import type { HealthReadyResponse } from "@lista/shared";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

export function healthRoutes(app: FastifyInstance, pool: Pool): void {
  // Bez bazy: zewnętrzne healthchecki nie mogą budzić Neona (deployment.md, ryzyka).
  app.get("/health", () => ({ status: "ok" }));

  app.get("/health/ready", async (request, reply) => {
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
}
