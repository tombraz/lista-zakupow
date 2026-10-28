import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createLists } from "../src/modules/listy";
import { buildTestApp } from "./app";
import { useTestDatabase } from "./database";
import { addMember, createList, createUser } from "./factories";

// TH-01, TH-02: jedno miejsce sprawdzania dostępu do listy (architecture.md, „Autoryzacja”).
describe("requireListAccess", () => {
  const db = useTestDatabase();

  async function ownerParticipantStranger() {
    const app = buildTestApp(db.pool);
    const [owner, participant, stranger] = [
      await createUser(app),
      await createUser(app),
      await createUser(app),
    ];
    await app.close();
    const list = await createList(db.pool, owner);
    await addMember(db.pool, list, participant);
    return { lists: createLists(db.pool), list, owner, participant, stranger };
  }

  it("gives the owner the role owner, also when owner rights are required", async () => {
    const { lists, list, owner } = await ownerParticipantStranger();

    await expect(lists.requireListAccess(owner.id, list.id, "member")).resolves.toEqual({
      listId: list.id,
      role: "owner",
    });
    await expect(lists.requireListAccess(owner.id, list.id, "owner")).resolves.toEqual({
      listId: list.id,
      role: "owner",
    });
  });

  it("gives a participant the role participant", async () => {
    const { lists, list, participant } = await ownerParticipantStranger();

    await expect(lists.requireListAccess(participant.id, list.id, "member")).resolves.toEqual({
      listId: list.id,
      role: "participant",
    });
  });

  it("refuses a participant an owner action with owner_only", async () => {
    const { lists, list, participant } = await ownerParticipantStranger();

    await expect(lists.requireListAccess(participant.id, list.id, "owner")).rejects.toMatchObject({
      code: "owner_only",
    });
  });

  it("treats someone else's list exactly like a list that does not exist", async () => {
    const { lists, list, stranger } = await ownerParticipantStranger();

    for (const required of ["member", "owner"] as const) {
      await expect(lists.requireListAccess(stranger.id, list.id, required)).rejects.toMatchObject({
        code: "not_found",
      });
      await expect(
        lists.requireListAccess(stranger.id, randomUUID(), required),
      ).rejects.toMatchObject({ code: "not_found" });
      await expect(
        lists.requireListAccess(stranger.id, "nie-uuid", required),
      ).rejects.toMatchObject({ code: "not_found" });
    }
  });
});
