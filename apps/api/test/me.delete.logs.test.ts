import { describe, expect, it } from "vitest";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { addMember, createList, createUser } from "./factories";
import { captureLogs } from "./logs";
import { requestsAs } from "./requests";

// T-062 SEC4 (TH-21): ślad usunięcia konta w logu `security`, same identyfikatory.
describe("DELETE /api/v1/me in the security log", () => {
  const db = useTestDatabase();

  it("logs account_deleted with the userId, without the e-mail or the name", async () => {
    const logs = captureLogs();
    const app = buildTestApp(db.pool, { logger: { level: "info", stream: logs.stream } });
    const ania = await createUser(app, { name: "Anastazja", email: "anastazja.k@example.com" });
    const tomek = await createUser(app, { name: "Tomek" });
    const list = await createList(db.pool, ania, "Spiżarnia");
    await addMember(db.pool, list, tomek);

    const response = await requestsAs(app, ania)("DELETE", "/api/v1/me", { confirm: true });

    expect(response.statusCode).toBe(204);
    const deleted = logs.security().filter((entry) => entry["event"] === "account_deleted");
    expect(deleted).toEqual([
      expect.objectContaining({ event: "account_deleted", userId: ania.id, route: "/api/v1/me" }),
    ]);
    const text = logs.lines.join("\n");
    for (const personal of [ania.email, "anastazja", "Anastazja", "Spiżarnia"]) {
      expect(text).not.toContain(personal);
    }
    await app.close();
  });

  it("logs nothing when the deletion is refused", async () => {
    const logs = captureLogs();
    const app = buildTestApp(db.pool, { logger: { level: "info", stream: logs.stream } });
    const ania = await createUser(app);

    await requestsAs(app, ania)("DELETE", "/api/v1/me", {});

    expect(logs.security().filter((entry) => entry["event"] === "account_deleted")).toEqual([]);
    await app.close();
  });
});
