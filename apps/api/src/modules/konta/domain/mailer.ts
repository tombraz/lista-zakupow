/** Wiadomość tekstowa; aplikacja wysyła tylko mail resetu hasła (F-03). */
export interface Mail {
  to: string;
  subject: string;
  text: string;
}

/**
 * Granica systemu: dostawca maili (lokalnie Mailpit, na serwerze Brevo — T-055, w testach
 * adapter przechwytujący; testing-strategy.md, „Mocki tylko na granicach”).
 */
export interface Mailer {
  send(mail: Mail): Promise<void>;
}

/** Dostawca odmówił wysyłki; tylko status HTTP — treść odpowiedzi bywa z adresem (TH-21). */
export class MailDeliveryError extends Error {
  constructor(readonly status: number) {
    super(`mail provider answered ${String(status)}`);
    this.name = "MailDeliveryError";
  }
}
