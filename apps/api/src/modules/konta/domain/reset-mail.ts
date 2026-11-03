import type { Mail } from "./mailer";

/** Strona kroku 2 SC-03 w web (T-054). */
const RESET_PAGE = "/reset-hasla";

/**
 * Mail resetu hasła (SC-03, Copy `mail.subject`, `mail.body`) — jedyny tekst po polsku tworzony
 * przez API. Link zawsze na originie aplikacji, nigdy z nagłówka `Host` ani `redirectTo` (TH-14).
 */
export function passwordResetMail(origin: string, to: string, token: string): Mail {
  const link = new URL(RESET_PAGE, origin);
  link.searchParams.set("token", token);
  return {
    to,
    subject: "Reset hasła — Wspólna lista zakupów",
    text:
      "Ktoś poprosił o reset hasła do Twojego konta. Kliknij link, żeby ustawić nowe hasło " +
      `(ważny 1 godzinę): ${link.href}. Jeśli to nie Ty, zignoruj tę wiadomość.`,
  };
}
