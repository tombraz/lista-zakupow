import { expect } from "@playwright/test";

/** Port Mailpita serwera E2E (`e2e/server.ts`); stały, bo maile czyta proces testów. */
export const MAILPIT_PORT = Number(process.env["E2E_MAILPIT_PORT"] ?? "3125");
const MAILPIT_URL = `http://127.0.0.1:${String(MAILPIT_PORT)}`;

interface MailpitSearch {
  messages: { ID: string }[];
}

/**
 * Ścieżka linku z najnowszego maila resetu hasła do `to` (`/reset-hasla?token=…`), z API
 * Mailpita (testing-strategy.md, „Dane testowe”). Mail wychodzi w tle, więc czeka na niego.
 */
export async function resetLinkFor(to: string): Promise<string> {
  let id = "";
  await expect
    .poll(async () => {
      const query = encodeURIComponent(`to:"${to}"`);
      const response = await fetch(`${MAILPIT_URL}/api/v1/search?query=${query}`);
      const { messages } = (await response.json()) as MailpitSearch;
      id = messages[0]?.ID ?? "";
      return id;
    })
    .not.toBe("");
  const message = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${id}`)).json()) as {
    Text: string;
  };
  const link = /https?:\/\/[^/\s]+(\/reset-hasla\?token=[A-Za-z0-9_-]+)/.exec(message.Text);
  if (!link?.[1]) throw new Error("no reset link in the mail");
  return link[1];
}
