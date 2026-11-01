import type { Mail, Mailer } from "../src/modules/konta/domain/mailer";

/** Adapter przechwytujący: zapisuje maile zamiast je wysyłać (granica systemu). */
export function capturingMailer(options: { delayMs?: number } = {}) {
  const sent: Mail[] = [];
  const mailer: Mailer = {
    async send(mail) {
      if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
      sent.push(mail);
    },
  };
  return { mailer, sent };
}
