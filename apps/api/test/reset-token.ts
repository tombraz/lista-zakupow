import type { Pool } from "pg";
import { vi } from "vitest";
import type { AppOptions } from "../src/app";
import { buildTestApp, TEST_ORIGIN } from "./app";
import { createUser, randomIp, type TestUser } from "./factories";
import { capturingMailer } from "./mailer";

/** Token z linku w mailu resetu (`/reset-hasla?token=…`). */
export function tokenOfMail(text: string): string {
  const token = /\/reset-hasla\?token=([A-Za-z0-9_-]+)/.exec(text)?.[1];
  if (!token) throw new Error("no reset link in the mail");
  return token;
}

/**
 * Aplikacja z kontem, które poprosiło o reset hasła, i tokenem z przechwyconego maila
 * (jak w produkcji: przez `POST /api/auth/request-password-reset`).
 */
export async function resetTokenFor(
  pool: Pool,
  options: Partial<AppOptions> = {},
): Promise<{ app: ReturnType<typeof buildTestApp>; user: TestUser; token: string }> {
  const { mailer, sent } = capturingMailer();
  const app = buildTestApp(pool, { mailer, ...options });
  const user = await createUser(app);
  const token = await requestResetToken(app, user, sent);
  return { app, user, token };
}

/** Kolejna prośba o reset dla konta; zwraca token z nowego maila. */
export async function requestResetToken(
  app: ReturnType<typeof buildTestApp>,
  user: Pick<TestUser, "email">,
  sent: { text: string }[],
): Promise<string> {
  const before = sent.length;
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/request-password-reset",
    headers: { origin: TEST_ORIGIN },
    remoteAddress: randomIp(),
    payload: { email: user.email },
  });
  if (response.statusCode !== 200) throw new Error(`reset request failed: ${response.body}`);
  await vi.waitFor(() => {
    if (sent.length <= before) throw new Error("no reset mail yet");
  });
  return tokenOfMail(sent[sent.length - 1]?.text ?? "");
}
