import { describe, expect, it } from "vitest";
import { createLiveHub } from "../src/modules/na-zywo";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { createList, createUser } from "./factories";
import { captureLogs } from "./logs";
import { requestsAs } from "./requests";

// T-076 AC1 (F-16): imię jest już zapisane, więc błąd rozesłania zdarzeń trafia tylko do logu.
describe("PATCH /api/v1/me when the live announcement fails", () => {
  const db = useTestDatabase();

  it("answers 200 with the new name and logs the failure without the name or the e-mail", async () => {
    const logs = captureLogs();
    const live = createLiveHub();
    live.publish = () => {
      throw new Error("live hub broken");
    };
    const app = buildTestApp(db.pool, { live, logger: { level: "info", stream: logs.stream } });
    const tomek = await createUser(app, { name: "Tomek", email: "tomek.k@example.com" });
    await createList(db.pool, tomek, "Działka");
    const asTomek = requestsAs(app, tomek);

    const response = await asTomek("PATCH", "/api/v1/me", { name: "Bartłomiej" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ id: tomek.id, name: "Bartłomiej", email: tomek.email });
    expect((await asTomek("GET", "/api/v1/me")).json()).toMatchObject({ name: "Bartłomiej" });
    const failures = logs.entries().filter((entry) => entry["level"] === 50);
    expect(failures.map((entry) => [entry["event"], entry["err"]])).toEqual([
      ["live_announce_failed", expect.objectContaining({ type: "Error" })],
    ]);
    const text = logs.lines.join("\n");
    for (const personal of ["Bartłomiej", "Tomek", tomek.email, "live hub broken"]) {
      expect(text).not.toContain(personal);
    }
    await app.close();
  });

  // Ta sama przyczyna w DELETE /api/v1/me: konto już usunięte, połączenia na żywo i tak się kończą.
  it("answers 204 to DELETE /api/v1/me and still closes the account's live connections", async () => {
    const logs = captureLogs();
    const live = createLiveHub();
    live.publish = () => {
      throw new Error("live hub broken");
    };
    const closed: string[] = [];
    live.closeUser = (userId) => closed.push(userId);
    const app = buildTestApp(db.pool, { live, logger: { level: "info", stream: logs.stream } });
    const ania = await createUser(app);
    await createList(db.pool, ania, "Spiżarnia");

    const response = await requestsAs(app, ania)("DELETE", "/api/v1/me", { confirm: true });

    expect(response.statusCode).toBe(204);
    expect(closed).toEqual([ania.id]);
    expect(logs.entries().filter((entry) => entry["level"] === 50)).toHaveLength(1);
    await app.close();
  });
});
