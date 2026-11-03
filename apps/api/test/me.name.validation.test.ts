import { describe, expect, it } from "vitest";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { createUser } from "./factories";
import { requestsAs } from "./requests";

// T-061 AC2, SEC1 (TH-29), SEC2: niepoprawne imię odrzucone, imię i inne pola bez zmian.
describe("PATCH /api/v1/me validation", () => {
  const db = useTestDatabase();

  const refused: [string, unknown, string][] = [
    ["empty", { name: "" }, "required"],
    ["only spaces", { name: "   " }, "required"],
    ["missing", {}, "required"],
    ["31 characters", { name: "a".repeat(31) }, "too_long"],
    ["right-to-left override", { name: `Ania${String.fromCodePoint(0x202e)}cba` }, "invalid"],
    ["only a zero-width space", { name: String.fromCodePoint(0x200b) }, "invalid"],
    ["control character", { name: "Ania\u0007" }, "invalid"],
    ["NUL", { name: "Ania\u0000" }, "invalid"],
  ];

  it.each(refused)(
    "refuses a name that is %s with 400 and keeps the old one",
    async (_, body, code) => {
      const app = buildTestApp(db.pool);
      const tomek = await createUser(app, { name: "Tomek" });
      const asTomek = requestsAs(app, tomek);

      const response = await asTomek("PATCH", "/api/v1/me", body as Record<string, unknown>);

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: { code: "validation_failed", fields: { name: code } },
      });
      expect((await asTomek("GET", "/api/v1/me")).json<{ name: string }>().name).toBe("Tomek");
      await app.close();
    },
  );

  it("accepts exactly 30 characters with Polish letters and emoji", async () => {
    const app = buildTestApp(db.pool);
    const tomek = await createUser(app, { name: "Tomek" });
    const name = `Żółć${"a".repeat(24)}🍎🛒`;
    expect(Array.from(name)).toHaveLength(30);

    const response = await requestsAs(app, tomek)("PATCH", "/api/v1/me", { name });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ name: string }>().name).toBe(name);
    await app.close();
  });

  it("ignores fields other than the name", async () => {
    const app = buildTestApp(db.pool);
    const tomek = await createUser(app, { name: "Tomek" });
    const asTomek = requestsAs(app, tomek);

    const response = await asTomek("PATCH", "/api/v1/me", {
      name: "Tomasz",
      email: "intruz@example.com",
      id: "someone-else",
      emailVerified: true,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ id: tomek.id, name: "Tomasz", email: tomek.email });
    expect((await asTomek("GET", "/api/v1/me")).json()).toEqual({
      id: tomek.id,
      name: "Tomasz",
      email: tomek.email,
    });
    await app.close();
  });
});
