import { and, asc, desc, eq, exists, inArray, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { listMember, shoppingList, user } from "../../../db/schema";
import type {
  InvitationTarget,
  JoinOutcome,
  ListPeople,
  ListItems,
  ListRole,
  ListsRepository,
  Person,
  ShoppingList,
} from "../domain/lists";

/** Transakcja wołającego (inny moduł): zmiana razem z jego zapisem albo wcale. */
export type Transaction = Pick<NodePgDatabase, "select" | "insert">;

/**
 * Blokuje wiersz listy do końca transakcji wołającego: szereguje równoległe zmiany pod
 * limitami liczonymi na liście (layers/db.md, „Konwencje”). Zwraca właściciela albo `null`.
 */
export async function lockList(
  tx: Pick<NodePgDatabase, "select">,
  listId: string,
): Promise<{ ownerId: string } | null> {
  const [list] = await tx
    .select({ ownerId: shoppingList.ownerId })
    .from(shoppingList)
    .where(eq(shoppingList.id, listId))
    .for("update");
  return list ?? null;
}

/** F-12: limit liczony pod blokadą listy, więc bez wyścigu (data-model.md). */
export async function insertParticipant(
  tx: Transaction,
  listId: string,
  userId: string,
  limit: number,
): Promise<JoinOutcome> {
  const list = await lockList(tx, listId);
  // data-model.md: właściciel nie jest wierszem `list_member`.
  if (list?.ownerId === userId) return "own_list";
  const members = await tx
    .select({ userId: listMember.userId })
    .from(listMember)
    .where(eq(listMember.listId, listId));
  if (members.some((member) => member.userId === userId)) return "already_member";
  if (members.length >= limit) return "limit_reached";
  await tx.insert(listMember).values({ listId, userId });
  return "joined";
}

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
      // eslint-disable-next-line no-restricted-syntax -- `updated_at` listy tylko porządkuje SC-05; klient nie porównuje nim wersji (T-017)
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

  async participantCount(listId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(listMember)
      .where(eq(listMember.listId, listId));
    return row?.count ?? 0;
  }

  async peopleWithAccess(listId: string): Promise<ListPeople | null> {
    const [[list], members] = await Promise.all([
      this.db
        .select({ ownerId: shoppingList.ownerId })
        .from(shoppingList)
        .where(eq(shoppingList.id, listId)),
      this.db
        .select({ id: listMember.userId })
        .from(listMember)
        .where(eq(listMember.listId, listId)),
    ]);
    return list ? { ownerId: list.ownerId, participantIds: members.map(({ id }) => id) } : null;
  }

  async invitationTarget(listId: string): Promise<InvitationTarget | null> {
    const [row] = await this.db
      .select({ listName: shoppingList.name, ownerName: user.name })
      .from(shoppingList)
      .innerJoin(user, eq(user.id, shoppingList.ownerId))
      .where(eq(shoppingList.id, listId));
    return row ?? null;
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
