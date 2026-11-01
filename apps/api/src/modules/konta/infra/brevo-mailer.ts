import { MailDeliveryError, MailTimeoutError, type Mail, type Mailer } from "../domain/mailer";

const BREVO_API = "https://api.brevo.com";
const SENDER_NAME = "Wspólna lista zakupów";
// AC2 T-055: bez odpowiedzi w 10 s wysyłka się kończy błędem w logu (odpowiedź API jest już wysłana).
const TIMEOUT_MS = 10_000;

export interface BrevoSettings {
  apiKey: string;
  /** Zweryfikowany w Brevo adres właściciela (`MAIL_FROM`; deployment.md) — z konfiguracji. */
  sender: string;
  /** Tylko testy: Brevo podstawione lokalnie. */
  baseUrl?: string;
}

/** Staging i produkcja: Brevo HTTP API, nadawca z konfiguracji (deployment.md, epic E-02). */
export class BrevoMailer implements Mailer {
  readonly endpoint: string;

  constructor(private readonly settings: BrevoSettings) {
    this.endpoint = new URL("/v3/smtp/email", settings.baseUrl ?? BREVO_API).href;
  }

  async send(mail: Mail): Promise<void> {
    const abort = new AbortController();
    const timer = setTimeout(() => {
      abort.abort(new MailTimeoutError(TIMEOUT_MS));
    }, TIMEOUT_MS);
    try {
      await this.post(mail, abort.signal);
    } finally {
      clearTimeout(timer);
    }
  }

  private async post(mail: Mail, signal: AbortSignal): Promise<void> {
    const response = await fetch(this.endpoint, {
      signal,
      method: "POST",
      headers: {
        "api-key": this.settings.apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { email: this.settings.sender, name: SENDER_NAME },
        to: [{ email: mail.to }],
        subject: mail.subject,
        textContent: mail.text,
      }),
    });
    await response.body?.cancel();
    if (!response.ok) throw new MailDeliveryError(response.status);
  }
}
