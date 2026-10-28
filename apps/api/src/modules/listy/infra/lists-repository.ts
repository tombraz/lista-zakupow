import { and, asc, desc, eq, exists, inArray, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { listMember, shoppingList, user } from "../../../db/schema";
import type { ListItems, ListRole, ListsRepository, Person, ShoppingList } from "../domain/lists";

export class DrizzleListsRepository implements ListsRepository {
  constructor(
    private readonly db: NodePgDatabase,
    /** Pozycje posiada moduł `pozycje` (granice modułów, CODING_STANDARDS.md). */
    private readonly items: Pick<ListItems, "toBuyCounts">,
  ) {}

  async roleOf(userId: string, listId: string): Promise<ListRole | null> {
    const [row] = await this.db
      .select({
        role: sql<ListRole>`CASE WHEN ${shoppingList.ownerId} = ${userId} THEN 'owner' ELSE 'participant' END`,
      })
      .from(shoppingList)
      .leftJoin(
        listMember,
        and(eq(listMember.listId, shoppingList.id), eq(listMember.userId, userId)),
      )
      .where(
        and(
          eq(shoppingList.id, listId),
          or(eq(shoppingList.ownerId, userId), eq(listMember.userId, userId)),
        ),
      );
    return row?.role ?? null;
  }

  async insertWithinLimit(ownerId: string, name: string, limit: number): Promise<string | null> {
    // data-model.md: blokada wiersza właściciela szereguje równoległe tworzenie jego list.
    return this.db.transaction(async (tx) => {
      await tx.select({ id: user.id }).from(user).where(eq(user.id, ownerId)).for("update");
      const [owned] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(shoppingList)
        .where(eq(shoppingList.ownerId, ownerId));
      if ((owned?.count ?? 0) >= limit) return null;
      const [row] = await tx
        .insert(shoppingList)
        .values({ ownerId, name })
        .returning({ id: shoppingList.id });
      if (!row) throw new Error("insert into shopping_list returned no row");
      return row.id;
    });
  }

  async rename(listId: string, name: string): Promise<void> {
    await this.db
      .update(shoppingList)
      .set({ name, updatedAt: sql`now()` })
      .where(eq(shoppingList.id, listId));
  }

  async delete(listId: string): Promise<void> {
    await this.db.delete(shoppingList).where(eq(shoppingList.id, listId));
  }

  async listsOf(userId: string, listId?: string): Promise<ShoppingList[]> {
    const isMember = exists(
      this.db
        .select({ one: sql`1` })
        .from(listMember)
        .where(and(eq(listMember.listId, shoppingList.id), eq(listMember.userId, userId))),
    );
    const rows = await this.db
      .select({
        id: shoppingList.id,
        name: shoppingList.name,
        ownerId: shoppingList.ownerId,
        ownerName: user.name,
        updatedAt: shoppingList.updatedAt,
      })
      .from(shoppingList)
      .innerJoin(user, eq(user.id, shoppingList.ownerId))
      .where(
        and(
          or(eq(shoppingList.ownerId, userId), isMember),
          listId === undefined ? undefined : eq(shoppingList.id, listId),
        ),
      )
      // data-model.md: od ostatnio zmienionej; id (UUID v7) rozstrzyga remis.
      .orderBy(desc(shoppingList.updatedAt), desc(shoppingList.id));
    const listIds = rows.map((row) => row.id);
    const [members, toBuy] = await Promise.all([
      this.membersOf(listIds),
      this.items.toBuyCounts(listIds),
    ]);
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      owner: { id: row.ownerId, name: row.ownerName },
      members: members.get(row.id) ?? [],
      toBuyCount: toBuy.get(row.id) ?? 0,
      updatedAt: row.updatedAt,
    }));
  }

  private async membersOf(listIds: string[]): Promise<Map<string, Person[]>> {
    const byList = new Map<string, Person[]>();
    if (listIds.length === 0) return byList;
    const rows = await this.db
      .select({ listId: listMember.listId, id: user.id, name: user.name })
      .from(listMember)
      .innerJoin(user, eq(user.id, listMember.userId))
      .where(inArray(listMember.listId, listIds))
      .orderBy(asc(listMember.joinedAt));
    for (const { listId, ...person } of rows) {
      byList.set(listId, [...(byList.get(listId) ?? []), person]);
    }
    return byList;
  }
}
