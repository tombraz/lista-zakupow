import type { FastifyBaseLogger } from "fastify";
import { errorSummary } from "../logging";

/**
 * Zdarzenia na żywo po zatwierdzonym zapisie (layers/backend.md, „Pułapki”): ich błąd (hub, baza
 * przy odczycie osób z dostępem) nie zmienia wyniku zapisu w 500, tylko trafia do logu — sam typ
 * i stos, bez komunikatu, nazw list i pozycji, imion i e-maili (T-076, T-089). Jedyne miejsce,
 * z którego trasy `modules/*\/http` rozsyłają zdarzenia (reguła w eslint.config.js).
 */
export async function afterCommit(log: FastifyBaseLogger, announce: () => unknown): Promise<void> {
  try {
    await announce();
  } catch (error) {
    log.error({ event: "live_announce_failed", err: errorSummary(error) }, "live events not sent");
  }
}
