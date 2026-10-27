import { describe, expect, it } from "vitest";
import { buildTestApp, TEST_ORIGIN } from "./app";
import { cookieHeader } from "./cookies";
import { useTestDatabase } from "./database";
import { createUser } from "./factories";

describe("POST /api/auth/sign-in/email", () => {
  const db = useTestDatabase();

  function signIn(app: ReturnType<typeof buildTestApp>, payload: object) {
    return app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      headers: { origin: TEST_ORIGIN },
      payload,
    });
  }

  it("starts a new session for the right e-mail and password (AC4)", async () => {
    const app = buildTestApp(db.pool);
    const user = await createUser(app, { name: "Bartek" });

    const response = await signIn(app, {
      email: user.email.toUpperCase(),
      password: user.password,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ user: { id: user.id, name: "Bartek", email: user.email } });
    const cookie = cookieHeader(response.headers["set-cookie"]);
    expect(cookie).not.toBe(user.cookie);
    const me = await app.inject({ method: "GET", url: "/api/v1/me", headers: { cookie } });
    expect(me.json()).toEqual({ id: user.id, name: "Bartek", email: user.email });
    await app.close();
  });

  it("answers the same 401 invalid_credentials for an unknown e-mail and a wrong password (SEC2)", async () => {
    const app = buildTestApp(db.pool);
    const user = await createUser(app);

    const wrongPassword = await signIn(app, { email: user.email, password: "zle-haslo-123" });
    const unknownEmail = await signIn(app, {
      email: "nikt@example.com",
      password: "zle-haslo-123",
    });

    expect(wrongPassword.statusCode).toBe(401);
    expect(wrongPassword.json()).toEqual({ error: { code: "invalid_credentials" } });
    expect(unknownEmail.statusCode).toBe(wrongPassword.statusCode);
    expect(unknownEmail.body).toBe(wrongPassword.body);
    expect(unknownEmail.headers["set-cookie"]).toBeUndefined();
    expect(wrongPassword.headers["set-cookie"]).toBeUndefined();
    await app.close();
  });

  it("answers 400 validation_failed for an empty form", async () => {
    const app = buildTestApp(db.pool);

    const response = await signIn(app, { email: "", password: "" });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: { code: "validation_failed", fields: { email: "required", password: "required" } },
    });
    await app.close();
  });
});
