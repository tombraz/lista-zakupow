import { describe, expect, it } from "vitest";
import { buildTestApp, TEST_ORIGIN } from "./app";
import { useTestDatabase } from "./database";
import { createUser, randomIp, signIn } from "./factories";
import { requestsAs } from "./requests";

// T-062 SEC1 (TH-17): po usunięciu konta żadna jego sesja nie działa, a logowanie się nie udaje.
describe("DELETE /api/v1/me ends the account's sessions", () => {
  const db = useTestDatabase();

  it("answers 401 to every session and the same invalid_credentials as for an unknown account", async () => {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app);
    const phone = await signIn(app, ania);
    const signInAs = (email: string, password: string) =>
      app.inject({
        method: "POST",
        url: "/api/auth/sign-in/email",
        headers: { origin: TEST_ORIGIN },
        remoteAddress: randomIp(),
        payload: { email, password },
      });

    const response = await requestsAs(app, ania)("DELETE", "/api/v1/me", { confirm: true });

    expect(response.statusCode).toBe(204);
    for (const cookie of [ania.cookie, phone]) {
      const me = await requestsAs(app, { cookie })("GET", "/api/v1/me");
      expect(me.statusCode).toBe(401);
      expect(me.json()).toEqual({ error: { code: "unauthenticated" } });
    }
    const deleted = await signInAs(ania.email, ania.password);
    const unknown = await signInAs("nikt@example.com", ania.password);
    expect(deleted.statusCode).toBe(401);
    expect(deleted.json()).toEqual({ error: { code: "invalid_credentials" } });
    expect(unknown.json()).toEqual(deleted.json());
    await app.close();
  });

  // QA plan, J-01: e-mail usuniętego konta jest wolny dla nowej rejestracji.
  it("lets the same e-mail sign up again", async () => {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app);
    await requestsAs(app, ania)("DELETE", "/api/v1/me", { confirm: true });

    const again = await createUser(app, { email: ania.email });

    expect(again.id).not.toBe(ania.id);
    await app.close();
  });
});
