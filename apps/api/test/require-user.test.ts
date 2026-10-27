import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { apiErrors } from "../src/http/api-error";
import { accountRoutes } from "../src/modules/konta";
import { TEST_ORIGIN, TEST_SECRET } from "./app";
import { useTestDatabase } from "./database";
import { createUser } from "./factories";

// QA round 1, #5: trasy kolejnych modułów (T-005) chronią się przez publiczne API modułu `konta`.
describe("Accounts.requireUser for routes of other modules", () => {
  const db = useTestDatabase();

  function appWithProtectedRoute() {
    const app = Fastify();
    apiErrors(app);
    const accounts = accountRoutes(app, db.pool, { secret: TEST_SECRET, origin: TEST_ORIGIN });
    app.get("/api/v1/chronione", async (request, reply) => {
      const user = await accounts.requireUser(request, reply);
      return { id: user.id, name: user.name, email: user.email };
    });
    return app;
  }

  it("answers 401 unauthenticated to an anonymous request", async () => {
    const app = appWithProtectedRoute();

    const response = await app.inject({ method: "GET", url: "/api/v1/chronione" });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: { code: "unauthenticated" } });
    await app.close();
  });

  it("gives the route the signed-in person", async () => {
    const app = appWithProtectedRoute();
    const user = await createUser(app);

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/chronione",
      headers: { cookie: user.cookie },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ id: user.id, name: user.name, email: user.email });
    await app.close();
  });
});
