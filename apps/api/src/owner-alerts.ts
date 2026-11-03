import type { FastifyBaseLogger } from "fastify";
import { deliveryFailure } from "./logging";

/**
 * N-03: tłumienie alarmów jednego zdarzenia — najwyżej jeden mail w tym oknie, żeby seria błędów
 * (np. awaria bazy) nie wyczerpała dziennego limitu Brevo potrzebnego na maile resetu (T-088).
 */
export const OWNER_ALERT_WINDOW_SECONDS = 15 * 60;

/** Alarm do właściciela projektu: nazwa zdarzenia z logu, jego czas i tekst bez danych osób. */
export interface OwnerAlert {
  event: string;
  at: Date;
  subject: string;
  text: string;
}

export interface OwnerAlerts {
  /** Wysyła w tle; nie czeka na dostawcę i nie rzuca (odpowiedź trasy bez zmian). */
  raise(alert: OwnerAlert): void;
}

interface AlertMailer {
  send(mail: { to: string; subject: string; text: string }): Promise<void>;
}

/** Ostatni wysłany alarm zdarzenia i liczba pominiętych od niego. */
interface Window {
  sentAt: number;
  skipped: number;
}

/**
 * Alarmy mailem z API (architecture.md, „Obserwowalność”). Okno tłumienia w pamięci procesu —
 * jedna instancja API (ADR 0003); restart zeruje okno. Bez adresu (`ALERT_EMAIL`) alarm zostaje
 * tylko w logu, gdzie zdarzenie już jest.
 */
export function createOwnerAlerts(options: {
  mailer: AlertMailer;
  to: string | undefined;
  log: FastifyBaseLogger;
}): OwnerAlerts {
  const { mailer, to, log } = options;
  const windows = new Map<string, Window>();
  return {
    raise(alert) {
      if (!to) return;
      const at = alert.at.getTime();
      const window = windows.get(alert.event);
      if (window && at < window.sentAt + OWNER_ALERT_WINDOW_SECONDS * 1000) {
        window.skipped += 1;
        return;
      }
      windows.set(alert.event, { sentAt: at, skipped: 0 });
      const skipped = `Pominięte takie same zdarzenia od poprzedniego alarmu: ${String(window?.skipped ?? 0)}`;
      const mail = { to, subject: alert.subject, text: `${alert.text}\n\n${skipped}\n` };
      mailer.send(mail).catch((error: unknown) => {
        // TH-21: bez adresu alarmu i treści — tylko zdarzenie i status dostawcy.
        log.error(
          { event: "owner_alert_failed", alert: alert.event, ...deliveryFailure(error) },
          "owner alert not sent",
        );
      });
    },
  };
}
