import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MailDeliveryError } from "../src/modules/konta/domain/mailer";
import { MailpitMailer } from "../src/modules/konta/infra/mailpit-mailer";
import { startMailpit } from "./mailpit";

interface MailpitMessage {
  ID: string;
  To: { Address: string }[];
  Subject: string;
}

// AC2: lokalnie mail resetu trafia do Mailpita przez jego HTTP send API.
describe("Mailpit mailer (AC2)", () => {
  let mailpit: Awaited<ReturnType<typeof startMailpit>>;

  beforeAll(async () => {
    mailpit = await startMailpit();
  });

  afterAll(async () => {
    await mailpit.stop();
  });

  async function inbox(to: string) {
    const response = await fetch(
      `${mailpit.url}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`,
    );
    return ((await response.json()) as { messages: MailpitMessage[] }).messages;
  }

  it("delivers the mail to the Mailpit inbox", async () => {
    const to = `ania-${randomUUID()}@example.com`;
    const mailer = new MailpitMailer(mailpit.url);

    await mailer.send({ to, subject: "Reset hasła — Wspólna lista zakupów", text: "Treść ąę" });

    const messages = await inbox(to);
    expect(messages.map((message) => [message.To[0]?.Address, message.Subject])).toEqual([
      [to, "Reset hasła — Wspólna lista zakupów"],
    ]);
    const message = await fetch(`${mailpit.url}/api/v1/message/${messages[0]?.ID ?? ""}`);
    expect(((await message.json()) as { Text: string }).Text.trim()).toBe("Treść ąę");
  });

  it("rejects with the provider status when Mailpit refuses the mail", async () => {
    const mailer = new MailpitMailer(mailpit.url);

    const sending = mailer.send({ to: "to nie jest adres", subject: "x", text: "x" });

    await expect(sending).rejects.toBeInstanceOf(MailDeliveryError);
    await expect(sending).rejects.toMatchObject({ status: 400 });
  });
});
