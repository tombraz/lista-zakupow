import type { Item } from "@lista/shared";
import { describe, expect, it } from "vitest";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { addMember, createItem, createList, createUser } from "./factories";
import { captureLogs } from "./logs";
import { requestsAs } from "./requests";

// T-058 AC1 (F-13): właściciel usuwa uczestnika.
describe("DELETE /api/v1/lists/:listId/members/:userId", () => {
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

  it("answers 204, removes the membership and keeps the items the participant added and checked", async () => {
    const { app, ania, tomek, ola, list } = await homeOfAnia();
    const asTomek = requestsAs(app, tomek);
    const added = await asTomek("POST", `/api/v1/lists/${list.id}/items`, { name: "Mleko" });
    const bread = await createItem(db.pool, list, ania, "Chleb");
    const checked = await asTomek("PATCH", `/api/v1/lists/${list.id}/items/${bread.id}`, {
      checked: true,
    });
    expect([added.statusCode, checked.statusCode]).toEqual([201, 200]);

    const response = await requestsAs(app, ania)(
      "DELETE",
      `/api/v1/lists/${list.id}/members/${tomek.id}`,
    );

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe("");
    const members = await requestsAs(app, ania)("GET", `/api/v1/lists/${list.id}/members`);
    expect(members.json()).toEqual({
      owner: { id: ania.id, name: "Ania" },
      participants: [{ id: ola.id, name: "Ola", email: ola.email }],
    });
    const details = await requestsAs(app, ania)("GET", `/api/v1/lists/${list.id}`);
    const items = details.json<{ items: Item[] }>().items;
    expect(items.find((item) => item.name === "Mleko")?.addedBy).toEqual({
      id: tomek.id,
      name: "Tomek",
    });
    expect(items.find((item) => item.name === "Chleb")?.checkedBy).toEqual({
      id: tomek.id,
      name: "Tomek",
    });
    const tomeksLists = await asTomek("GET", "/api/v1/lists");
    expect(tomeksLists.json()).toEqual([]);
    await app.close();
  });

  // SEC4 (TH-21): ślad usunięcia w logu `security`, same identyfikatory.
  it("logs member_removed with the list, the owner and the removed participant, without names or e-mails", async () => {
    const logs = captureLogs();
    const app = buildTestApp(db.pool, { logger: { level: "info", stream: logs.stream } });
    const ania = await createUser(app, { name: "Ania" });
    const tomek = await createUser(app, { name: "Tomek" });
    const list = await createList(db.pool, ania, "Dom");
    await addMember(db.pool, list, tomek);

    await requestsAs(app, ania)("DELETE", `/api/v1/lists/${list.id}/members/${tomek.id}`);

    const removed = logs.security().filter((entry) => entry["event"] === "member_removed");
    expect(removed).toEqual([
      expect.objectContaining({
        event: "member_removed",
        listId: list.id,
        userId: ania.id,
        removedUserId: tomek.id,
        route: "/api/v1/lists/:listId/members/:userId",
      }),
    ]);
    const text = logs.lines.join("\n");
    for (const personal of [ania.email, tomek.email, "Tomek", "Ania", "Dom"]) {
      expect(text).not.toContain(personal);
    }
    await app.close();
  });
});
