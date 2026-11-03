import { MailDeliveryError, type Mail, type Mailer } from "../domain/mailer";

// Mailpit przyjmuje każdego nadawcę; Brevo wymaga zweryfikowanego (T-055).
const SENDER = { Email: "lista@localhost", Name: "Wspólna lista zakupów" };

/** Lokalnie (Docker Compose): HTTP send API Mailpita, podgląd na `MAILPIT_URL` (epic E-02). */
export class MailpitMailer implements Mailer {
  constructor(private readonly url: string) {}

  async send(mail: Mail): Promise<void> {
    const response = await fetch(new URL("/api/v1/send", this.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        From: SENDER,
        To: [{ Email: mail.to }],
        Subject: mail.subject,
        Text: mail.text,
      }),
    });
    await response.body?.cancel();
    if (!response.ok) throw new MailDeliveryError(response.status);
  }
}
