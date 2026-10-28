import { describe, expect, it } from "vitest";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { createList, createUser } from "./factories";
import { requestsAs } from "./requests";

// AC2 (F-05): nazwa listy 1–100 znaków po obcięciu spacji, przy tworzeniu i zmianie nazwy.
describe("list name validation", () => {
  const db = useTestDatabase();

  async function listNames(): Promise<string[]> {
    const { rows } = await db.pool.query<{ name: string }>("SELECT name FROM shopping_list");
    return rows.map((row) => row.name);
  }

  it("rejects creating a list with a blank, missing or 101-character name", async () => {
    const app = buildTestApp(db.pool);
    const asAnia = requestsAs(app, await createUser(app));

    for (const [payload, code] of [
      [{ name: "   " }, "required"],
      [{ name: "" }, "required"],
      [{}, "required"],
      [{ name: "a".repeat(101) }, "too_long"],
    ] as const) {
      const response = await asAnia("POST", "/api/v1/lists", payload);

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: { code: "validation_failed", fields: { name: code } },
      });
    }
    expect(await listNames()).toEqual([]);
    await app.close();
  });

  it("rejects renaming a list to a blank or 101-character name and keeps the old name", async () => {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app);
    const list = await createList(db.pool, ania, "Zakupy");
    const asAnia = requestsAs(app, ania);

    for (const [name, code] of [
      ["  ", "required"],
      ["a".repeat(101), "too_long"],
    ] as const) {
      const response = await asAnia("PATCH", `/api/v1/lists/${list.id}`, { name });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: { code: "validation_failed", fields: { name: code } },
      });
    }
    expect(await listNames()).toEqual(["Zakupy"]);
    await app.close();
  });
});
