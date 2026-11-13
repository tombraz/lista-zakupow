import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import type { Clock } from "../clock";
import { logFailure } from "../logging";
import { CLEANUP_INTERVAL_MS, cleanUpIfDue } from "./run";

/** Pierwsze sprawdzenie po starcie: nadrabia sprzątanie zaległe w czasie uśpienia maszyny. */
export const CLEANUP_START_DELAY_MS = 10_000;
const MIN_WAIT_MS = 1000;

export interface CleanupSchedule {
  /** Koniec trwającego sprawdzenia (i sprzątania); testy czekają na niego po przesunięciu timerów. */
  settled(): Promise<void>;
}

/**
 * Codzienne sprzątanie w procesie API, bez osobnego crona (data-model.md): od startu do
 * zamknięcia aplikacji. Timer nie trzyma procesu przy życiu.
 */
export function scheduleCleanup(
  app: FastifyInstance,
  { pool, clock }: { pool: Pool; clock: Clock },
): CleanupSchedule {
  let timer: NodeJS.Timeout | undefined;
  let current: Promise<void> = Promise.resolve();
  let stopped = false;

  const wait = (ms: number) => {
    timer = setTimeout(() => {
      current = check();
    }, ms);
    timer.unref();
  };

  async function check(): Promise<void> {
    const next = await cleanUpIfDue(pool, clock, app.log).catch((error: unknown) => {
      logFailure(app.log, "cleanup_failed", error);
      return new Date(clock.now().getTime() + CLEANUP_INTERVAL_MS);
    });
    if (stopped) return;
    const untilNext = next.getTime() - clock.now().getTime();
    wait(Math.min(Math.max(untilNext, MIN_WAIT_MS), CLEANUP_INTERVAL_MS));
  }

  app.addHook("onReady", () => {
    wait(CLEANUP_START_DELAY_MS);
    return Promise.resolve();
  });
  app.addHook("onClose", async () => {
    stopped = true;
    clearTimeout(timer);
    await current;
  });
  return { settled: () => current };
}
