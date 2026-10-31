import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildTestApp, TEST_SECRET } from "./app";
import { sessionCookie } from "./cookies";
import { useTestDatabase } from "./database";
import { randomIp } from "./factories";

const ORIGIN = "https://lista.example";

// T-050 (TH-16): na originie https ciasteczko sesji jest niedostępne dla JS i nie idzie po http.
describe("session cookie on an https origin (TH-16)", () => {
  const db = useTestDatabase();

  it("sets a Secure, HttpOnly, SameSite=Lax session cookie on an https origin", async () => {
    const app = buildTestApp(db.pool, { auth: { secret: TEST_SECRET, origin: ORIGIN } });
    const account = { email: `user-${randomUUID()}@example.com`, password: "dobre-haslo-1" };
    const post = (url: string, payload: object) =>
      app.inject({
        method: "POST",
        url,
        headers: { origin: ORIGIN },
        remoteAddress: randomIp(),
        payload,
      });

    const signedUp = await post("/api/auth/sign-up/email", {
      ...account,
      name: "Ania",
      termsAccepted: true,
      ageConfirmed: true,
    });
    const signedIn = await post("/api/auth/sign-in/email", account);

    for (const response of [signedUp, signedIn]) {
      expect(response.statusCode).toBe(200);
      const cookie = sessionCookie(response.headers["set-cookie"]);
      expect(cookie).toMatch(/;\s*HttpOnly/i);
      expect(cookie).toMatch(/;\s*Secure/i);
      expect(cookie).toMatch(/;\s*SameSite=Lax/i);
    }
    await app.close();
  });
});
