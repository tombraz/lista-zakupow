import { describe, expect, it } from "vitest";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { captureLogs } from "./logs";
import { createUser } from "./factories";
import { requestsAs } from "./requests";

const SECRET_NAME = "Prezent dla Ani";

// SEC5 (QA round 1 #1): CODING_STANDARDS.md, „Obsługa błędów” — szczegóły tylko w logu,
// a do logu bez parametrów zapytań z treścią użytkownika (architecture.md, „Obserwowalność”).
describe("unexpected error in /api/v1/*", () => {
  const db = useTestDatabase();

  it("answers 500 internal with the requestId and logs no exception message", async () => {
    const logs = captureLogs();
    const app = buildTestApp(db.pool, { logger: { level: "info", stream: logs.stream } });
    // Prawdziwa awaria bazy z wartością od użytkownika w parametrach zapytania.
    app.get("/api/v1/test/failing-query", async () => {
      await db.pool.query("SELECT $1::int", [SECRET_NAME]);
    });

    const response = await app.inject({ method: "GET", url: "/api/v1/test/failing-query" });

    expect(response.statusCode).toBe(500);
    const body = response.json<{ error: { code: string; requestId: string } }>();
    expect(body.error.requestId).toEqual(expect.any(String));
    expect(body).toEqual({ error: { code: "internal", requestId: body.error.requestId } });
    expect(response.body).not.toContain(SECRET_NAME);
    expect(response.body).not.toContain("SELECT");

    const errors = logs.entries().filter((entry) => entry["level"] === 50);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      requestId: body.error.requestId,
      err: { type: "DatabaseError", code: "22P02" },
    });
    expect(logs.lines.join("\n")).not.toContain(SECRET_NAME);
    await app.close();
  });

  it("rejects a list name with the NUL character with 400 instead of a database error", async () => {
    const app = buildTestApp(db.pool);
    const asAnia = requestsAs(app, await createUser(app));

    const created = await asAnia("POST", "/api/v1/lists", { name: "a\u0000b" });
    expect(created.statusCode).toBe(400);
    expect(created.json()).toEqual({
      error: { code: "validation_failed", fields: { name: "invalid" } },
    });

    const list = (await asAnia("POST", "/api/v1/lists", { name: "Zakupy" })).json<{ id: string }>();
    const renamed = await asAnia("PATCH", `/api/v1/lists/${list.id}`, { name: "\u0000" });
    expect(renamed.statusCode).toBe(400);
    expect(renamed.json()).toEqual({
      error: { code: "validation_failed", fields: { name: "invalid" } },
    });
    await app.close();
  });
});
