import type { Mail, Mailer } from "../src/modules/konta/domain/mailer";

/**
 * Adapter przechwytujący: zapisuje maile zamiast je wysyłać (granica systemu). `requested` —
 * wywołania `send` (początek wysyłki), `sent` — dostarczone. Z `hold` dostarczenie czeka na
 * `release()`, więc test sprawdza „nie czeka na mail” bez zegara.
 */
export function capturingMailer(options: { hold?: boolean } = {}) {
  const requested: Mail[] = [];
  const sent: Mail[] = [];
  let open: () => void = () => undefined;
  const gate = options.hold
    ? new Promise<void>((resolve) => {
        open = resolve;
      })
    : undefined;
  const mailer: Mailer = {
    async send(mail) {
      requested.push(mail);
      await gate;
      sent.push(mail);
    },
  };
  return {
    mailer,
    requested,
    sent,
    release: () => {
      open();
    },
  };
}
