import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { addMember, createList, createUser } from "./factories";
import { requestsAs } from "./requests";

// T-057 AC1, SEC1 (F-13, TH-19): uczestnicy listy na SC-07.
describe("GET /api/v1/lists/:listId/members", () => {
  const db = useTestDatabase();

  async function homeOfAnia() {
    const app = buildTestApp(db.pool);
    const ania = await createUser(app, { name: "Ania" });
    const tomek = await createUser(app, { name: "Tomek" });
    const ola = await createUser(app, { name: "Ola" });
    const list = await createList(db.pool, ania, "Dom");
    await addMember(db.pool, list, tomek);
    await addMember(db.pool, list, ola);
    return { app, ania, tomek, ola, list };
  }

  it("gives the owner the participants with e-mails, in the order they joined", async () => {
    const { app, ania, tomek, ola, list } = await homeOfAnia();

    const response = await requestsAs(app, ania)("GET", `/api/v1/lists/${list.id}/members`);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      owner: { id: ania.id, name: "Ania" },
      participants: [
        { id: tomek.id, name: "Tomek", email: tomek.email },
        { id: ola.id, name: "Ola", email: ola.email },
      ],
    });
    await app.close();
  });

  it("gives a participant everyone without an email key, including the owner and themselves", async () => {
    const { app, ania, tomek, ola, list } = await homeOfAnia();

    const response = await requestsAs(app, tomek)("GET", `/api/v1/lists/${list.id}/members`);

    expect(response.statusCode).toBe(200);
    const members = response.json<{ owner: object; participants: object[] }>();
    expect(members).toEqual({
      owner: { id: ania.id, name: "Ania" },
      participants: [
        { id: tomek.id, name: "Tomek" },
        { id: ola.id, name: "Ola" },
      ],
    });
    for (const person of [members.owner, ...members.participants]) {
      expect(Object.keys(person)).toEqual(["id", "name"]);
    }
    for (const someone of [ania, tomek, ola]) expect(response.body).not.toContain(someone.email);
    await app.close();
  });

  // SEC2 (TH-01): brak dostępu = ten sam 404 co nieistniejąca lista, bez treści.
  it("answers 404 to someone without access and to a bad listId, 401 to an anonymous request", async () => {
    const { app, list } = await homeOfAnia();
    const bartek = await createUser(app, { name: "Bartek" });
    const asBartek = requestsAs(app, bartek);

    const foreign = await asBartek("GET", `/api/v1/lists/${list.id}/members`);
    const missing = await asBartek("GET", `/api/v1/lists/${randomUUID()}/members`);
    const malformed = await asBartek("GET", "/api/v1/lists/nie-uuid/members");
    const anonymous = await requestsAs(app, null)("GET", `/api/v1/lists/${list.id}/members`);

    for (const response of [foreign, missing, malformed]) {
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: { code: "not_found" } });
    }
    expect(foreign.body).toBe(missing.body);
    expect(anonymous.statusCode).toBe(401);
    expect(anonymous.json()).toEqual({ error: { code: "unauthenticated" } });
    await app.close();
  });
});
